export type BootstrapStatus =
  | { bootstrapRequired: true }
  | { bootstrapRequired: false }

export interface BootstrapAdminInput {
  username: string
  password: string
}

