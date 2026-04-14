import { createLogger } from '../../utils/logger.js';
import type { AgentInterface } from './agent-interface.js';
import type { AgentTask } from './types.js';

/**
 * Agent Factory - manages agent registration and retrieval
 *
 * The factory maintains a registry of all available agents and provides
 * methods to retrieve agents based on task type or name.
 */
export class AgentFactory {
  private static instance: AgentFactory;
  private agents = new Map<string, AgentInterface>();
  private taskTypeToAgent = new Map<string, string>();
  private logger = createLogger('AgentFactory');

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of AgentFactory
   */
  static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * Register an agent
   * @param agent The agent to register
   * @param taskTypes The task types this agent can handle
   */
  register(agent: AgentInterface, taskTypes: string[] = []): void {
    this.logger.info(`Registering agent: ${agent.name}`, {
      version: agent.version,
      capabilities: agent.capabilities,
    });

    // Register by name
    this.agents.set(agent.name, agent);

    // Register by task type if provided
    for (const taskType of taskTypes) {
      this.taskTypeToAgent.set(taskType, agent.name);
    }

    this.logger.debug(`Agent ${agent.name} registered successfully`);
  }

  /**
   * Unregister an agent
   * @param name The name of the agent to unregister
   */
  unregister(name: string): boolean {
    this.logger.info(`Unregistering agent: ${name}`);

    const agent = this.agents.get(name);
    if (!agent) {
      this.logger.warn(`Agent ${name} not found`);
      return false;
    }

    // Remove task type mappings
    for (const [taskType, agentName] of this.taskTypeToAgent.entries()) {
      if (agentName === name) {
        this.taskTypeToAgent.delete(taskType);
      }
    }

    // Remove agent
    this.agents.delete(name);
    this.logger.debug(`Agent ${name} unregistered successfully`);

    return true;
  }

  /**
   * Get an agent by name
   * @param name The name of the agent
   * @returns The agent or undefined if not found
   */
  getAgent(name: string): AgentInterface | undefined {
    return this.agents.get(name);
  }

  /**
   * Get an agent that can handle a specific task
   * @param task The task to find an agent for
   * @returns The agent or undefined if no agent can handle the task
   */
  async getAgentForTask(task: AgentTask): Promise<AgentInterface | undefined> {
    // First check if we have a direct mapping
    const mappedAgentName = this.taskTypeToAgent.get(task.type);
    if (mappedAgentName) {
      const agent = this.agents.get(mappedAgentName);
      if (agent) {
        return agent;
      }
    }

    // Otherwise, find an agent that can handle the task
    for (const agent of this.agents.values()) {
      if (await agent.canHandle(task)) {
        return agent;
      }
    }

    this.logger.warn(`No agent found for task type: ${task.type}`);
    return undefined;
  }

  /**
   * Get all registered agents
   * @returns Array of all registered agents
   */
  getAllAgents(): AgentInterface[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get names of all registered agents
   * @returns Array of agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if an agent is registered
   * @param name The name of the agent
   * @returns true if the agent is registered
   */
  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get the count of registered agents
   * @returns Number of registered agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Initialize all registered agents
   */
  async initializeAll(): Promise<void> {
    this.logger.info('Initializing all agents...');

    const initPromises = Array.from(this.agents.values()).map(async (agent) => {
      if (agent.initialize) {
        try {
          await agent.initialize();
          this.logger.debug(`Agent ${agent.name} initialized`);
        } catch (error) {
          this.logger.error(`Failed to initialize agent ${agent.name}`, error);
        }
      }
    });

    await Promise.all(initPromises);
    this.logger.info('All agents initialized');
  }

  /**
   * Cleanup all registered agents
   */
  async cleanupAll(): Promise<void> {
    this.logger.info('Cleaning up all agents...');

    const cleanupPromises = Array.from(this.agents.values()).map(async (agent) => {
      if (agent.cleanup) {
        try {
          await agent.cleanup();
          this.logger.debug(`Agent ${agent.name} cleaned up`);
        } catch (error) {
          this.logger.error(`Failed to cleanup agent ${agent.name}`, error);
        }
      }
    });

    await Promise.all(cleanupPromises);
    this.logger.info('All agents cleaned up');
  }

  /**
   * Get health status of all agents
   */
  getHealthStatuses(): Array<ReturnType<AgentInterface['getHealth']>> {
    return Array.from(this.agents.values())
      .filter((agent) => agent.getHealth)
      .map((agent) => agent.getHealth()!);
  }

  /**
   * Get statistics for all agents
   */
  getAllStats(): Array<ReturnType<AgentInterface['getStats']>> {
    return Array.from(this.agents.values())
      .filter((agent) => agent.getStats)
      .map((agent) => agent.getStats()!);
  }

  /**
   * Clear all registered agents (mainly for testing)
   */
  clear(): void {
    this.logger.warn('Clearing all agents');
    this.agents.clear();
    this.taskTypeToAgent.clear();
  }

  /**
   * Get task types mapped to agent names
   */
  getTaskTypeMappings(): Record<string, string> {
    return Object.fromEntries(this.taskTypeToAgent);
  }
}

/**
 * Convenience function to get the AgentFactory instance
 */
export function getAgentFactory(): AgentFactory {
  return AgentFactory.getInstance();
}
