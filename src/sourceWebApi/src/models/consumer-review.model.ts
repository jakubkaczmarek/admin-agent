export enum ReviewStatus {
  New = 0,
  AutoAccepted = 1,
  AutoRejected = 2,
  PendingReview = 3,
  Accepted = 4,
  Rejected = 5  
}

export interface IConsumerReview {
  Id: number;
  ClientId: number;
  DateTime: Date;
  Rating: number;
  Comment: string;
  Status: ReviewStatus;
}

export interface ICreateConsumerReview {
  ClientId: number;
  DateTime: Date;
  Rating: number;
  Comment: string;
  Status?: ReviewStatus;
}

export interface IUpdateConsumerReviewStatus {
  Status: ReviewStatus;
}
