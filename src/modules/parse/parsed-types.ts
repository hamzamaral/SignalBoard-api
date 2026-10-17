export type ParsedPosition = {
  sequenceNo?: number;
  title: string;
  serviceClass?: string;
  grade?: number;
  quota?: number;
  educationRequirement?: string;
  gender?: string;
  kpssScoreType?: string;
  kpssMinScore?: number;
  skillsTags?: string[];
};

export type ParsedListingFields = {
  institutionName?: string;
  title?: string;
  position?: string;
  city?: string;
  educationLevel?: string;
  kpssScoreType?: string;
  kpssMinScore?: number;
  quota?: number;
  applyStartAt?: string;
  applyEndAt?: string;
  resultAt?: string;
  examAt?: string;
  resultAnnounceAt?: string;
  url?: string;
  applicationPlace?: string;
  applicationMethods?: string[];
  requiredDocuments?: string[];
  generalRequirements?: string;
  specialRequirements?: string;
  examTopics?: string;
  evaluationNotes?: string;
  requiredSkills?: string[];
  positions?: ParsedPosition[];
};
