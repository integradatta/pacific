import { redirect } from 'next/navigation';

// A raiz não tem tela própria; manda para o login (de lá, autenticado, vai ao dashboard).
export default function Home(): never {
  redirect('/login');
}
