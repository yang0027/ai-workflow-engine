// LLMStoryboardNode.config.ts

export interface Skill {
  id: string;
  name: string;
  systemPrompt: string;
}

export const DEFAULT_PROVIDER_LLM_MODELS: Record<string, string[]> = {
  minimax: ['abab6.5g-chat', 'abab6.5-chat', 'MiniMax-M2.7', 'MiniMax-M2.5'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ali: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  volcengine: ['doubao-pro-4k', 'doubao-lite-4k']
};

export interface LLMStoryboardNodeProps {
  id: string;
  data: {
    label?: string;
    inputs?: {
      prompt?: string;
      providerId?: string;
      model?: string;
      skillId?: string;
      temperature?: number;
      isLoopMode?: boolean;
      loopPromptsText?: string;
      currentIndex?: number;
      autoStep?: boolean;
    };
    outputs?: {
      storyboard?: string;
      output?: string;
      errorMsg?: string;
    };
  };
  selected?: boolean;
}
