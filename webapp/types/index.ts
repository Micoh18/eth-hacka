export type TaskState = "idle" | "scanning" | "quote" | "executing" | "success" | "error";

export interface Machine {
  name: string;
  url: string;
  description: string;
}

export interface Capability {
  id: string;
  endpoint: string;
  method: string;
  description: string;
  payment_required: boolean;
  default_amount_eth?: string;
  schema?: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  capabilities: Capability[];
  payment_config: {
    chainId: number;
    chainName: string;
    token: string;
    recipient: string;
    rpcUrl: string;
  };
}

export interface PaymentDetails {
  chainId: number;
  chainName: string;
  token: string;
  recipient: string;
  amount: string;
  description: string;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  [key: string]: any;
}

export interface ParsedIntent {
  type: 'action' | 'chat';
  action?: string;
  device?: string;
  params?: Record<string, any>;
  confidence?: number;
  message?: string;
}

export interface TaskData {
  intent: string;
  parsedIntent?: ParsedIntent;
  machine?: Machine;
  capability?: Capability;
  device?: Device;
  paymentDetails?: PaymentDetails;
  txHash?: string;
  error?: string;
  data?: {
    job_id?: string;
    job_proof?: string;
    file_name?: string;
    transaction_hash?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface TaskHistory {
  id: string;
  intent: string;
  state: TaskState;
  timestamp: Date;
  txHash?: string;
  device?: string;
}

