# Padrão visual do Tarefaa

Visual sóbrio e compacto: fundo azul-acinzentado, superfícies brancas com borda fina, quase sem sombra, tipografia IBM Plex Sans. Referência de implementação: `src/pages/Dashboard.tsx`.

## Estrutura de página

```tsx
<MainLayout>
  <Header
    title="Projetos"
    subtitle="Gerencie seus projetos"
    actions={<Button><Plus /> Novo projeto</Button>}
  />
  <PageBody>{/* conteúdo */}</PageBody>
</MainLayout>
```

- `Header` (`@/components/layout/Header`): título, subtítulo e, quando fizer sentido, `backTo` (seta de voltar), `leading` (ícone/avatar), `badge` (status) e `actions` (botões principais da página). O botão principal da página fica em `actions`, não numa linha separada.
- `PageBody` (`@/components/layout/PageBody`): espaçamento padrão `px-6 pb-6 pt-3 space-y-4`.

## Componentes

| Precisa de | Use |
|---|---|
| Card com título | `Panel` (`@/components/ui/panel`) com `title`, `icon`, `actions`; `bodyClassName="p-5"` para conteúdo, sem padding para listas |
| Card sem título | `div` com `rounded-xl border border-border bg-card p-5` |
| Dados rótulo/valor | `InfoList` + `InfoRow` (`@/components/ui/info-list`), `mono` para códigos/datas |
| Lista/tela vazia | `EmptyState` (`@/components/ui/empty-state`) |
| Indicador numérico | card `rounded-xl border bg-card p-4`, rótulo `text-xs text-muted-foreground`, número `text-2xl font-semibold tabular-nums`, ícone em quadrado `w-7 h-7 rounded-md bg-<cor>/10` |
| Abas principais da página | `<TabsList>` (estilo linha, padrão) |
| Filtros ou abas dentro de outra aba | `<TabsList variant="segmented">` |
| Status/selo | `Badge` com `variant` `default`, `secondary`, `success`, `warning`, `destructive`, `outline`; ou `StatusBadge`/`PriorityBadge` para tarefas |

## Regras

- **Botões:** use as variantes do `Button` (`default`, `outline`, `ghost`, `secondary`, `destructive`). Não use `gradient-primary`, `bg-gradient-*`, `text-white` ou sombras em botões. Tamanhos: padrão (36px), `sm` (32px), `icon` (36px). `lg`/`xl` e `variant="gradient"` são só da landing page.
- **Sombras:** nenhuma em cards (`shadow-soft`, `shadow-md`, `shadow-lg` saem). Sombra só em elementos flutuantes (menus, modais), que já vêm dos componentes base.
- **Cantos:** cards `rounded-xl`; botões, campos e itens internos `rounded-lg`/`rounded-md`. Nada de `rounded-2xl`.
- **Tipografia:** título de página `text-2xl font-semibold` (já no `Header`); título de card `font-semibold` (16px); texto `text-sm`; apoio `text-xs text-muted-foreground`. Números grandes no máximo `text-2xl font-semibold`. Rótulos sem `uppercase tracking-wide`.
- **Espaçamento:** padding de card `p-4`/`p-5` (não `p-6`/`p-8`); gaps de grade `gap-3`/`gap-4`; linhas de lista `px-5 py-2.5` com `divide-y divide-border`.
- **Interação:** hover muda cor/fundo (`hover:bg-muted/40`, `hover:border-primary/40`); nada de `hover:scale-*`, `hover:shadow-*` ou `-translate-y`.
- **Cores:** use tokens (`primary`, `muted`, `border`, `status-*`, `priority-*`). Cores fixas (`text-red-600`, `bg-emerald-500/10`) só para semântica de alerta/sucesso, sempre com variante `dark:`.
- **Ícones:** `w-4 h-4` em botões e títulos; ícone decorativo em quadrado `w-8 h-8 rounded-md` com fundo `/10`. O ícone/avatar de identidade (projeto, pessoa) pode manter `gradient-primary`.
- **Datas, códigos, contagens:** `font-mono` ou `tabular-nums`.
