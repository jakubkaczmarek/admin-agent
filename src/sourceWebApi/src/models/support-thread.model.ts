export enum SupportThreadStatus {
  Active = 0,
  Closed = 1
}

export interface ISupportThread {
  id: number;
  creatorUserName: string;
  createdOnDateTime: Date;
  modifierUserName: string;
  modifiedOnDateTime: Date;
  subject: string;
  category: string | null;
  status: SupportThreadStatus;
}

export interface ISupportThreadMessage {
  id: number;
  supportThreadId: number;
  creatorUserName: string;
  createdOnDateTime: Date;
  message: string;
}

export interface ICreateSupportThread {
  creatorUserName: string;
  subject: string;
  category?: string | null;
  message: string;
}

export interface ICreateSupportThreadMessage {
  creatorUserName: string;
  message: string;
}

export interface ISupportThreadWithMessages extends ISupportThread {
  messages: ISupportThreadMessage[];
}

export interface ISupportThreadFilter {
  status?: SupportThreadStatus;
}

export interface IPagedSupportThreads {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: ISupportThread[];
}
