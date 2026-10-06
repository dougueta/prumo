export const metadata = { title: "Sem conexão · Prumo" };

export default function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Você está sem conexão</h1>
      <p className="max-w-sm opacity-70">
        O Prumo precisa de internet para mostrar seus dados. Assim que a conexão voltar, é só tentar
        de novo.
      </p>
    </main>
  );
}
