export type User = {
  id: string;
  displayName: string;
  email?: string;
};

export type Problem = {
  id: string;
  slug: string;
  title: string;
  promptMd: string;
  timeboxMinutes: number;
  rubricVersion: string;
  adminOutlineMd?: string;
  weekOf: string;
  dueAt: string;
  sourceUrl?: string;
  sourceRoadmapTopic?: string;
  notifiedAt?: string;
  discordMessageId?: string;
  createdAt: string;
};

export type Attempt = {
  id: string;
  problemId: string;
  userId: string;
  diagramPath?: string;
  audioPath?: string;
  transcriptText?: string;
  diagramCaption?: string;
  gradeJson?: GradeResult;
  gradedAt?: string;
  gradeOverrideJson?: GradeResult;
  createdAt: string;
  updatedAt: string;
};

export type RoadmapItem = {
  id: string;
  topic: string;
  orderIndex: number;
  notesMd?: string;
  sourceUrl?: string;
};

export type CuratedQueueItem = {
  problemId: string;
  orderIndex: number;
  weekOf: string;
};

export type RoadmapCursor = {
  nextOrderIndex: number;
  updatedAt: string;
};

export type RubricDimension = {
  id: string;
  label: string;
  maxScore: number;
  guidance: string;
};

export type RubricV1 = {
  version: "rubric_v1";
  overallMax: number;
  dimensions: RubricDimension[];
};

export type RubricDimensionScore = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export type GradeResult = {
  rubricVersion: "rubric_v1";
  overallScore: number;
  overallMax: number;
  summary: string;
  dimensions: RubricDimensionScore[];
  failClosed?: boolean;
  error?: string;
};

export type Session = {
  userId: string;
  displayName: string;
};
