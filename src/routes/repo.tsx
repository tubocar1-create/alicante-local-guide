import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, GitBranch, GitCommit, ExternalLink, ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/repo")({
  head: () => ({
    meta: [
      { title: "Repositorio — Alicante Friend" },
      { name: "description", content: "Explora el repositorio conectado, sus ramas y commits." },
      { property: "og:title", content: "Repositorio — Alicante Friend" },
      { property: "og:description", content: "Explora ramas y commits del repositorio conectado." },
    ],
  }),
  component: RepoPage,
});

const STORAGE_KEY = "repo:url";

function parseRepo(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/\.git$/, "");
  const m = cleaned.match(/(?:github\.com[/:])?([^/\s]+)\/([^/\s?#]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  return res.json() as Promise<T>;
}

type Branch = { name: string; commit: { sha: string; url: string } };
type Commit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
};
type Repo = {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
};

function RepoPage() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setUrl(saved);
    setDraft(saved);
    if (!saved) setEditing(true);
  }, []);

  const parsed = parseRepo(url);

  const repoQ = useQuery({
    queryKey: ["repo", parsed?.owner, parsed?.repo],
    queryFn: () => gh<Repo>(`/repos/${parsed!.owner}/${parsed!.repo}`),
    enabled: !!parsed,
  });

  const branchesQ = useQuery({
    queryKey: ["branches", parsed?.owner, parsed?.repo],
    queryFn: () => gh<Branch[]>(`/repos/${parsed!.owner}/${parsed!.repo}/branches?per_page=50`),
    enabled: !!parsed,
  });

  const commitsQ = useQuery({
    queryKey: ["commits", parsed?.owner, parsed?.repo, repoQ.data?.default_branch],
    queryFn: () =>
      gh<Commit[]>(
        `/repos/${parsed!.owner}/${parsed!.repo}/commits?sha=${repoQ.data!.default_branch}&per_page=30`,
      ),
    enabled: !!parsed && !!repoQ.data?.default_branch,
  });

  function save() {
    const p = parseRepo(draft);
    if (!p) return;
    const normalized = `${p.owner}/${p.repo}`;
    localStorage.setItem(STORAGE_KEY, normalized);
    setUrl(normalized);
    setEditing(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="ml-2 flex items-center gap-2">
            <Github className="h-5 w-5" />
            <h1 className="text-base font-semibold">Repositorio</h1>
          </div>
          {parsed && !editing && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {(editing || !parsed) && (
          <Card className="p-4">
            <label className="mb-2 block text-sm font-medium">URL del repositorio de GitHub</label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://github.com/usuario/repo o usuario/repo"
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <Button onClick={save} disabled={!parseRepo(draft)}>
                Guardar
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Solo repositorios públicos. Los datos se obtienen en vivo de la API pública de GitHub.
            </p>
          </Card>
        )}

        {parsed && !editing && (
          <>
            <Card className="p-4">
              {repoQ.isLoading && <p className="text-sm text-muted-foreground">Cargando repositorio…</p>}
              {repoQ.isError && (
                <p className="text-sm text-destructive">
                  No se pudo cargar el repositorio. Verifica que sea público y la URL sea correcta.
                </p>
              )}
              {repoQ.data && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <a
                        href={repoQ.data.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold hover:underline"
                      >
                        {repoQ.data.full_name}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {repoQ.data.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{repoQ.data.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>★ {repoQ.data.stargazers_count}</span>
                    <span>⑂ {repoQ.data.forks_count}</span>
                    <span>● {repoQ.data.open_issues_count} issues</span>
                    <span>rama por defecto: <code className="font-mono">{repoQ.data.default_branch}</code></span>
                  </div>
                </div>
              )}
            </Card>

            <Tabs defaultValue="commits">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="commits">
                  <GitCommit className="mr-1.5 h-4 w-4" /> Commits
                </TabsTrigger>
                <TabsTrigger value="branches">
                  <GitBranch className="mr-1.5 h-4 w-4" /> Ramas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="commits" className="mt-3">
                <Card className="divide-y">
                  {commitsQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Cargando commits…</p>}
                  {commitsQ.isError && <p className="p-4 text-sm text-destructive">No se pudieron cargar los commits.</p>}
                  {commitsQ.data?.map((c) => (
                    <a
                      key={c.sha}
                      href={c.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 p-3 hover:bg-muted/50"
                    >
                      {c.author?.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.commit.message.split("\n")[0]}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <code className="font-mono">{c.sha.slice(0, 7)}</code> · {c.commit.author.name} ·{" "}
                          {new Date(c.commit.author.date).toLocaleString()}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </Card>
              </TabsContent>

              <TabsContent value="branches" className="mt-3">
                <Card className="divide-y">
                  {branchesQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Cargando ramas…</p>}
                  {branchesQ.isError && <p className="p-4 text-sm text-destructive">No se pudieron cargar las ramas.</p>}
                  {branchesQ.data?.map((b) => (
                    <div key={b.name} className="flex items-center gap-3 p-3">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <code className="font-mono">{b.commit.sha.slice(0, 7)}</code>
                        </p>
                      </div>
                      <a
                        href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/${b.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ver árbol
                      </a>
                      <a
                        href={`https://github.com/${parsed.owner}/${parsed.repo}/commits/${b.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        commits
                      </a>
                    </div>
                  ))}
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
