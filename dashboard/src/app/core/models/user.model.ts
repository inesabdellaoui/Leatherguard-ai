export type UserRole =
  | 'operatrice_bmw'
  | 'operatrice_rr'
  | 'responsable_qualite'
  | 'admin';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  idClient?: string | null;
  isActive?: boolean;
}