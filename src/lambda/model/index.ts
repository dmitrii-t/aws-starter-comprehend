/**
 * Model class TextLine
 */
export interface TextLine {
  client: string
  line: number
  text: string
  createdAt: number
  sentiment?: string
  updatedAt?: number
}
