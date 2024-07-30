export interface ResponseData<T> {
    error?: unknown
    ok: boolean
    result?: T
}
