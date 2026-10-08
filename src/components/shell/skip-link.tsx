/** Atalho "Pular para o conteúdo": primeiro foco da página (FR-020). */
export function SkipLink({ href = "#conteudo" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only z-demo rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Pular para o conteúdo
    </a>
  );
}
