// LLMStoryboardNode.config.ts

export interface Skill {
  id: string;
  name: string;
  systemPrompt: string;
}

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
