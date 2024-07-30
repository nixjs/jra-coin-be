import { ResponseData } from '../types/reponse'

export function toResponse<T = any>({ ...rest }: ResponseData<T>) {
    return rest
}
