export interface DemoCredential {
  userId: string;
  email: string;
  password: string;
}

export const demoCredentials: DemoCredential[] = [
{ userId: 'farmer-1', email: 'amina.bello@mail.ng', password: 'Farmer#2023' },
{ userId: 'farmer-2', email: 'musa.abubakar@mail.ng', password: 'Farmer#2023' },
{ userId: 'farmer-3', email: 'hauwa.garba@mail.ng', password: 'Farmer#2023' },
{ userId: 'farmer-4', email: 'sani.umar@mail.ng', password: 'Farmer#2023' },
{ userId: 'admin-1', email: 'admin@sokotocover.ng', password: 'Admin#2023' }];