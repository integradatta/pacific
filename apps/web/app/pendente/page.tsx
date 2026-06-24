import Link from 'next/link';

export default function PendentePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md panel p-8 text-center animate-rise">
        <p className="font-mono text-2xl text-sonar mb-3" aria-hidden>◷</p>
        <h1 className="font-display text-2xl font-semibold text-text tracking-tight">Conta em análise</h1>
        <p className="font-sans text-sm text-text-dim mt-2">
          Sua carteira foi criada e está <span className="text-text">aguardando aprovação</span> do administrador.
          Você receberá acesso assim que for aprovada.
        </p>
        <Link href="/login" className="inline-block font-mono text-xs text-sonar uppercase tracking-widest mt-6 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}
