# 搜索架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的搜索架构设计，支持全文搜索、向量搜索和复杂查询。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 高性能 | P95 查询延迟 < 100ms |
|相关性 | 搜索结果准确匹配用户意图 |
| 可扩展 | 支持千万级文档 |
| 多语言 | 支持中英文混合搜索 |
| 容错性 | 部分 Elasticsearch 节点故障不影响服务 |

### 1.2 搜索架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           搜索架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  应用层                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Search Query DSL                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Search Engine Layer                                 │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │   │
│  │  │   SQLite    │  │Elasticsearch│  │   Qdrant    │                    │   │
│  │  │   FTS5      │  │   (全文)    │  │  (向量)     │                    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐     │   │
│  │  │              Search Router (查询路由)                          │     │   │
│  │  └──────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  数据同步                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    CDC + Event Streaming                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SQLite FTS5 搜索

### 2.1 FTS5 配置

```sql
-- 创建 FTS5 虚拟表
CREATE VIRTUAL TABLE ideas_fts USING fts5(
  title,
  description,
  content,
  tags,
  tokenize='unicode61 remove_diacritics 2'

  -- 权重配置
  content='ideas',
  content_rowid='id'
);

-- 创建触发器保持同步
CREATE TRIGGER ideas_fts_insert AFTER INSERT ON ideas BEGIN
  INSERT INTO ideas_fts(rowid, title, description, content, tags)
  VALUES (new.id, new.title, new.description, new.content, new.tags);
END;

CREATE TRIGGER ideas_fts_delete AFTER DELETE ON ideas BEGIN
  INSERT INTO ideas_fts(ideas_fts, rowid, title, description, content, tags)
  VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
END;

CREATE TRIGGER ideas_fts_update AFTER UPDATE ON ideas BEGIN
  INSERT INTO ideas_fts(ideas_fts, rowid, title, description, content, tags)
  VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
  INSERT INTO ideas_fts(rowid, title, description, content, tags)
  VALUES (new.id, new.title, new.description, new.content, new.tags);
END;
```

### 2.2 FTS5 查询

```typescript
// src/search/sqlite-fts.ts
interface FTSQuery {
  term?: string;
  prefix?: string;
  booleanMode?: string;  // AND, OR, NOT
  highlight?: boolean;
  limit?: number;
  offset?: number;
}

class SQLiteFTSSearch {
  constructor(private db: Database) {}

  async searchIdeas(query: FTSQuery): Promise<IdeasSearchResult> {
    const { term, prefix, limit = 20, offset = 0 } = query;

    let sql = `
      SELECT
        i.*,
        bm25(ideas_fts) as score,
        snippet(ideas_fts, 1, '<mark>', '</mark>', '...', 32) as title_snippet,
        snippet(ideas_fts, 2, '<mark>', '</mark>', '...', 64) as desc_snippet
      FROM ideas_fts
      JOIN ideas i ON ideas_fts.rowid = i.id
      WHERE ideas_fts MATCH ${this.buildMatchExpression(query)}
      ORDER BY score
      LIMIT ${limit} OFFSET ${offset}
    `;

    const results = await this.db.execute(sql);

    return {
      items: results.rows,
      total: await this.getCount(query),
      offset,
      limit,
    };
  }

  private buildMatchExpression(query: FTSQuery): string {
    if (!query.term && !query.prefix) {
      return '""';  // 返回所有结果
    }

    const terms: string[] = [];

    if (query.term) {
      // 处理布尔操作符
      terms.push(`"${query.term}"`);
    }

    if (query.prefix) {
      // 前缀匹配
      terms.push(`"${query.prefix}"*`);
    }

    return terms.join(' OR ');
  }

  // BM25 排序
  async searchWithBM25(query: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<IdeasSearchResult> {
    const { limit = 20, offset = 0 } = options || {};

    const results = await this.db.execute(sql`
      SELECT
        i.*,
        bm25(ideas_fts, 1.0, 1.0, 10.0) as score,
        highlight(ideas_fts, 0, '<mark>', '</mark>') as title_highlight,
        highlight(ideas_fts, 1, '<mark>', '</mark>') as desc_highlight
      FROM ideas_fts
      JOIN ideas i ON ideas_fts.rowid = i.id
      WHERE ideas_fts MATCH ${query}
      ORDER BY score
      LIMIT ${limit} OFFSET ${offset}
    `);

    return {
      items: results.rows,
      total: await this.getCount({ term: query }),
      offset,
      limit,
    };
  }
}
```

---

## 3. Elasticsearch 搜索

### 3.1 索引映射

```typescript
// src/search/elasticsearch/mappings.ts
const PROJECT_INDEX_MAPPING = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        project_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'snowball'],
        },
        chinese_analyzer: {
          type: 'custom',
          tokenizer: 'ik_smart',
          filter: ['lowercase'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'project_analyzer',
        fields: {
          keyword: { type: 'keyword' },
          suggest: { type: 'completion' },
        },
      },
      description: {
        type: 'text',
        analyzer: 'project_analyzer',
      },
      content: {
        type: 'text',
        analyzer: 'project_analyzer',
      },
      tags: { type: 'keyword' },
      projectType: { type: 'keyword' },
      status: { type: 'keyword' },
      qualityScore: { type: 'float' },
      ownerId: { type: 'keyword' },
      tenantId: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      // 向量字段
      embedding: {
        type: 'dense_vector',
        dims: 1536,
        index: true,
        similarity: 'cosine',
      },
    },
  },
};

// 创建索引
async function createProjectIndex(es: Elasticsearch) {
  const indexExists = await es.indices.exists({ index: 'projects' });

  if (!indexExists) {
    await es.indices.create({
      index: 'projects',
      body: PROJECT_INDEX_MAPPING,
    });
  }
}
```

### 3.2 搜索查询

```typescript
// src/search/elasticsearch/queries.ts
interface SearchOptions {
  query?: string;
  filters?: {
    projectType?: string[];
    status?: string[];
    tags?: string[];
    dateRange?: { from: string; to: string };
    qualityScore?: { min?: number; max?: number };
  };
  vectorSearch?: {
    embedding: number[];
    minScore?: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    size: number;
  };
}

class ElasticsearchSearch {
  constructor(private es: Elasticsearch) {}

  async searchProjects(options: SearchOptions): Promise<SearchResult<Project>> {
    const { pagination = { page: 1, size: 20 }, sort, filters } = options;

    const query = this.buildQuery(options);
    const from = (pagination.page - 1) * pagination.size;

    const response = await this.es.search({
      index: 'projects',
      body: {
        query,
        from,
        size: pagination.size,
        sort: sort ? [{ [sort.field]: { order: sort.order } }] : undefined,
        highlight: {
          fields: {
            name: {},
            description: {},
            content: {},
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
        },
        aggs: {
          projectTypes: { terms: { field: 'projectType' } },
          tags: { terms: { field: 'tags', size: 20 } },
          avgQuality: { avg: { field: 'qualityScore' } },
        },
      },
    });

    return {
      items: response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
        _highlight: hit.highlight,
      })),
      total: response.hits.total.value,
      page: pagination.page,
      size: pagination.size,
      aggregations: response.aggregations,
    };
  }

  private buildQuery(options: SearchOptions): object {
    const must: object[] = [];
    const filter: object[] = [];

    // 全文搜索
    if (options.query) {
      must.push({
        multi_match: {
          query: options.query,
          fields: ['name^3', 'description^2', 'content', 'tags^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 向量搜索
    if (options.vectorSearch) {
      filter.push({
        script_score: {
          query: { match_all: {} },
          script: {
            source: 'cosineSimilarity(params.queryVector, "embedding") + 1.0',
            params: { queryVector: options.vectorSearch.embedding },
          },
        },
      });
    }

    // 过滤器
    if (options.filters) {
      if (options.filters.projectType?.length) {
        filter.push({ terms: { projectType: options.filters.projectType } });
      }
      if (options.filters.status?.length) {
        filter.push({ terms: { status: options.filters.status } });
      }
      if (options.filters.tags?.length) {
        filter.push({ terms: { tags: options.filters.tags } });
      }
      if (options.filters.dateRange) {
        filter.push({
          range: {
            createdAt: {
              gte: options.filters.dateRange.from,
              lte: options.filters.dateRange.to,
            },
          },
        });
      }
      if (options.filters.qualityScore) {
        filter.push({
          range: {
            qualityScore: {
              gte: options.filters.qualityScore.min,
              lte: options.filters.qualityScore.max,
            },
          },
        });
      }
    }

    return {
      bool: {
        must: must.length ? must : [{ match_all: {} }],
        filter,
      },
    };
  }

  // 自动补全
  async suggest(prefix: string, size: number = 5): Promise<string[]> {
    const response = await this.es.search({
      index: 'projects',
      body: {
        suggest: {
          project_suggest: {
            prefix,
            completion: {
              field: 'name.suggest',
              size,
              skip_duplicates: true,
            },
          },
        },
      },
    });

    return response.suggest.project_suggest[0].options.map(
      (opt: any) => opt.text
    );
  }
}
```

---

## 4. 向量搜索 (Qdrant)

### 4.1 向量存储配置

```typescript
// src/search/vector/collection.ts
interface CollectionConfig {
  name: string;
  vectorSize: number;        // 向量维度
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  optimizers?: {
    memmapThreshold?: number;
    indexingThreshold?: number;
  };
}

const PROJECT_COLLECTION: CollectionConfig = {
  name: 'projects',
  vectorSize: 1536,  // OpenAI embedding dimension
  distance: 'Cosine',
  optimizers: {
    memmapThreshold: 10000,
    indexingThreshold: 20000,
  },
};

class VectorStore {
  constructor(private qdrant: QdrantClient) {}

  async createCollection(config: CollectionConfig): Promise<void> {
    const exists = await this.qdrant.collectionExists(config.name);

    if (!exists) {
      await this.qdrant.createCollection(config.name, {
        vectors: {
          size: config.vectorSize,
          distance: config.distance,
        },
        optimizers_config: {
          default_segment_number: config.optimizers?.indexingThreshold || 2,
        },
      });
    }
  }

  async upsertVectors(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }>
  ): Promise<void> {
    await this.qdrant.upsert(collectionName, {
      wait: true,
      points,
    });
  }

  async search(
    collectionName: string,
    queryVector: number[],
    options?: {
      limit?: number;
      offset?: number;
      scoreThreshold?: number;
      filter?: Record<string, unknown>;
    }
  ): Promise<VectorSearchResult[]> {
    return this.qdrant.search(collectionName, {
      vector: queryVector,
      limit: options?.limit || 10,
      offset: options?.offset,
      scoreThreshold: options?.scoreThreshold,
      filter: options?.filter,
      with_payload: true,
    });
  }

  // 混合搜索 (向量 + 关键词)
  async hybridSearch(
    collectionName: string,
    queryVector: number[],
    keywordQuery: string,
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    // 1. 向量搜索
    const vectorResults = await this.search(collectionName, queryVector, {
      limit: limit * 2, // 获取更多结果以便融合
    });

    // 2. 获取对应的 payload 用于关键词匹配
    const ids = vectorResults.map((r) => r.id);

    // 3. RRF 融合 (Reciprocal Rank Fusion)
    const fusedResults = await this.rrfFusion(vectorResults, keywordQuery, limit);

    return fusedResults;
  }

  // RRF 融合算法
  private async rrfFusion(
    vectorResults: VectorSearchResult[],
    keywordQuery: string,
    limit: number
  ): Promise<VectorSearchResult[]> {
    const k = 60; // RRF 参数
    const scores = new Map<string, number>();

    // 向量搜索分数 (Rank 1 = 1/1, Rank 2 = 1/2, ...)
    vectorResults.forEach((result, index) => {
      const score = 1 / (k + index + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // 关键词搜索分数
    const keywordResults = await this.keywordSearch(keywordQuery);
    keywordResults.forEach((result, index) => {
      const score = 1 / (k + index + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // 排序并返回
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({
        id,
        score,
        payload: vectorResults.find((r) => r.id === id)?.payload,
      }));
  }
}
```

### 4.2 Embedding 生成

```typescript
// src/search/vector/embedding.ts
import { OpenAIEmbeddings } from '@langchain/openai';

class EmbeddingService {
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      dimensions: 1536,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embedding = await this.embeddings.embedQuery(text);
    return embedding;
  }

  async generateProjectEmbedding(project: Project): Promise<number[]> {
    // 组合项目信息生成 embedding
    const combinedText = `
      Project Name: ${project.name}
      Description: ${project.description}
      Type: ${project.projectType}
      Tags: ${project.tags.join(', ')}
      Status: ${project.status}
    `.trim();

    return this.generateEmbedding(combinedText);
  }

  // 批量生成
  async batchGenerateEmbeddings(
    texts: string[],
    batchSize: number = 100
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.embeddings.embedDocuments(batch);
      results.push(...embeddings);

      // 限流
      if (i + batchSize < texts.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 5. 搜索路由

### 5.1 查询路由

```typescript
// src/search/router.ts
enum SearchEngine {
  SQLITE_FTS = 'sqlite_fts',
  ELASTICSEARCH = 'elasticsearch',
  QDRANT = 'qdrant',
  HYBRID = 'hybrid',
}

interface SearchRequest {
  query: string;
  engine?: SearchEngine;
  options?: SearchOptions;
}

class SearchRouter {
  constructor(
    private sqliteFts: SQLiteFTSSearch,
    private elasticsearch: ElasticsearchSearch,
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService
  ) {}

  async search(request: SearchRequest): Promise<SearchResult<any>> {
    const { query, engine = this.selectEngine(request), options } = request;

    switch (engine) {
      case SearchEngine.SQLITE_FTS:
        return this.sqliteFts.searchIdeas({
          term: query,
          ...options,
        });

      case SearchEngine.ELASTICSEARCH:
        return this.elasticsearch.searchProjects({
          query,
          ...options,
        });

      case SearchEngine.QDRANT:
        return this.vectorSearch(query, options);

      case SearchEngine.HYBRID:
        return this.hybridSearch(query, options);

      default:
        throw new Error(`Unknown search engine: ${engine}`);
    }
  }

  // 自动选择搜索引擎
  private selectEngine(request: SearchRequest): SearchEngine {
    const { query } = request;

    // 向量语义搜索
    if (query.startsWith('similar:') || query.startsWith('like:')) {
      return SearchEngine.QDRANT;
    }

    // 混合搜索
    if (query.startsWith('hybrid:')) {
      return SearchEngine.HYBRID;
    }

    // 简单关键词搜索 -> SQLite FTS
    if (query.length < 50 && !query.includes(' AND ')) {
      return SearchEngine.SQLITE_FTS;
    }

    // 复杂查询 -> Elasticsearch
    return SearchEngine.ELASTICSEARCH;
  }

  // 混合搜索
  private async hybridSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<any>> {
    // 移除 hybrid: 前缀
    const cleanQuery = query.replace(/^hybrid:\s*/, '');

    // 生成 embedding
    const embedding = await this.embeddingService.generateEmbedding(cleanQuery);

    // 向量搜索
    const vectorResults = await this.vectorStore.search('projects', embedding, {
      limit: options?.pagination?.size || 20,
    });

    // 关键词搜索
    const keywordResults = await this.elasticsearch.searchProjects({
      query: cleanQuery,
      ...options,
    });

    // RRF 融合
    const fusedResults = this.rrfFusion(
      vectorResults,
      keywordResults.items,
      60
    );

    return {
      items: fusedResults,
      total: fusedResults.length,
      page: options?.pagination?.page || 1,
      size: options?.pagination?.size || 20,
    };
  }
}
```

---

## 6. 数据同步

### 6.1 CDC 同步

```typescript
// src/search/sync/cdc.ts
class SearchIndexSync {
  constructor(
    private db: Database,
    private elasticsearch: ElasticsearchSearch,
    private qdrant: VectorStore,
    private embeddingService: EmbeddingService
  ) {}

  // 初始化全量同步
  async fullSync(): Promise<SyncResult> {
    let offset = 0;
    const batchSize = 100;
    let synced = 0;

    while (true) {
      const projects = await this.db.execute(sql`
        SELECT * FROM projects
        ORDER BY id
        LIMIT ${batchSize} OFFSET ${offset}
      `);

      if (projects.rows.length === 0) break;

      // 批量索引到 Elasticsearch
      await this.bulkIndexToES(projects.rows);

      // 批量生成向量并索引
      await this.bulkIndexToVector(projects.rows);

      synced += projects.rows.length;
      offset += batchSize;

      console.log(`Synced ${synced} projects...`);
    }

    return { synced, failed: 0 };
  }

  // 增量同步 (CDC)
  async incrementalSync(event: DatabaseEvent): Promise<void> {
    const { table, operation, data, oldData } = event;

    switch (table) {
      case 'projects':
        await this.syncProject(operation, data, oldData);
        break;
      case 'ideas':
        await this.syncIdea(operation, data, oldData);
        break;
    }
  }

  private async syncProject(
    operation: 'insert' | 'update' | 'delete',
    data: Project,
    oldData?: Project
  ) {
    if (operation === 'delete') {
      await this.elasticsearch.deleteDocument('projects', data.id);
      await this.qdrant.deletePoints('projects', [data.id]);
      return;
    }

    // 索引到 Elasticsearch
    await this.elasticsearch.indexDocument('projects', data);

    // 生成向量并索引
    const embedding = await this.embeddingService.generateProjectEmbedding(data);
    await this.qdrant.upsertVectors('projects', [
      {
        id: data.id,
        vector: embedding,
        payload: {
          name: data.name,
          description: data.description,
          projectType: data.projectType,
          tags: data.tags,
        },
      },
    ]);
  }
}
```

---

## 7. 相关文档

- [后端设计](./BACKEND_DESIGN.md)
- [数据模型设计](./DATA_MODEL_DESIGN.md)
- [知识库系统](./KNOWLEDGE_BASE_SYSTEM.md)

---

**最后更新**: 2026-04-14
