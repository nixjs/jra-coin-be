export enum TransactionType {
    'FREEZE',
    'UNFREEZE',
    'DEBIT',
    'CREDIT',
}

export enum TransactionDetailType {
    'DEPOSIT',
    'WITHDRAW',
    'REFUND',
    'MOVE_FUND',
}

export enum TransactionStatus {
    'REQUESTED',
    'SUBMITTING',
    'SUBMITTED',
    'PROCESSING',
    'BROADCAST',
    'SUCCESSFUL',
    'FAILED',
    'REFUNDED',
}
