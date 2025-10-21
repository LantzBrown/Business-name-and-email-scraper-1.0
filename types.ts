
export interface BusinessData {
  id: number;
  [key: string]: any;
  ownerTitle?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
  niche?: string;
  uncertainty?: string;
  status?: RowStatus;
}

export enum ProcessingStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export enum RowStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  FOUND = 'Found',
  NOT_FOUND = 'Not Found',
  ERROR = 'Error',
}
