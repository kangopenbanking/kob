// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (ORDER P1, P4, P9)
// /developer/install — single-page install commands for all official SDKs at v1.5.0.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, ExternalLink, Package, BookOpen, ShieldCheck } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const SDK_VERSION = "1.5.0";

type SdkRow = {
  language: string;
  packageName: string;
  registry: "npm" | "PyPI" | "Packagist" | "Go modules";
  registryUrl: string;
  repoUrl: string;
  docsRoute: string;
  installCommands: { label: string; cmd: string }[];
  importSnippet: { language: string; code: string };
};

const SDKS: SdkRow[] = [
  {
    language: "Node.js / TypeScript",
    packageName: "@kangopenbanking/sdk",
    registry: "npm",
    registryUrl: "https://www.npmjs.com/package/@kangopenbanking/sdk",
    repoUrl: "https://github.com/kangopenbanking/sdk-node",
    docsRoute: "/developer/guides/sdks/node",
    installCommands: [
      { label: "npm", cmd: `npm install @kangopenbanking/sdk@${SDK_VERSION}` },
      { label: "yarn", cmd: `yarn add @kangopenbanking/sdk@${SDK_VERSION}` },
      { label: "pnpm", cmd: `pnpm add @kangopenbanking/sdk@${SDK_VERSION}` },
      { label: "bun", cmd: `bun add @kangopenbanking/sdk@${SDK_VERSION}` },
    ],
    importSnippet: {
      language: "TypeScript",
      code: `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: process.env.KOB_CLIENT_ID!,
  clientSecret: process.env.KOB_CLIENT_SECRET!,
  environment: 'sandbox',
});`,
    },
  },
  {
    language: "Python",
    packageName: "kangopenbanking",
    registry: "PyPI",
    registryUrl: "https://pypi.org/project/kangopenbanking/",
    repoUrl: "https://github.com/kangopenbanking/sdk-python",
    docsRoute: "/developer/guides/sdks/python",
    installCommands: [
      { label: "pip", cmd: `pip install kangopenbanking==${SDK_VERSION}` },
      { label: "poetry", cmd: `poetry add kangopenbanking@${SDK_VERSION}` },
      { label: "uv", cmd: `uv add kangopenbanking==${SDK_VERSION}` },
    ],
    importSnippet: {
      language: "Python",
      code: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id=os.environ["KOB_CLIENT_ID"],
    client_secret=os.environ["KOB_CLIENT_SECRET"],
    environment="sandbox",
)`,
    },
  },
  {
    language: "PHP / Laravel",
    packageName: "kangopenbanking/sdk",
    registry: "Packagist",
    registryUrl: "https://packagist.org/packages/kangopenbanking/sdk",
    repoUrl: "https://github.com/kangopenbanking/sdk-php",
    docsRoute: "/developer/guides/sdks/php",
    installCommands: [
      { label: "composer", cmd: `composer require kangopenbanking/sdk:^${SDK_VERSION}` },
    ],
    importSnippet: {
      language: "PHP",
      code: `use Kangopenbanking\\KOB;

$kob = new KOB([
    'client_id'     => getenv('KOB_CLIENT_ID'),
    'client_secret' => getenv('KOB_CLIENT_SECRET'),
    'environment'   => 'sandbox',
]);`,
    },
  },
  {
    language: "Go",
    packageName: "github.com/kangopenbanking/sdk-go",
    registry: "Go modules",
    registryUrl: "https://pkg.go.dev/github.com/kangopenbanking/sdk-go",
    repoUrl: "https://github.com/kangopenbanking/sdk-go",
    docsRoute: "/developer/guides/sdks/go",
    installCommands: [
      { label: "go get", cmd: `go get github.com/kangopenbanking/sdk-go@v${SDK_VERSION}` },
    ],
    importSnippet: {
      language: "Go",
      code: `import kob "github.com/kangopenbanking/sdk-go"

client := kob.New(kob.Config{
    ClientID:     os.Getenv("KOB_CLIENT_ID"),
    ClientSecret: os.Getenv("KOB_CLIENT_SECRET"),
    Environment:  "sandbox",
})`,
    },
  },
];

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};

export default function SdkInstallPage() {
  return (
    <>
      <Helmet>
        <title>Install the Kang Open Banking SDKs (v{SDK_VERSION}) — Kang Open Banking</title>
        <meta
          name="description"
          content={`Install the official KOB SDKs for Node, Python, PHP, and Go at v${SDK_VERSION}. Public registries: npm, PyPI, Packagist, pkg.go.dev. Copy/paste commands and minimal init snippets.`}
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/install" />
      </Helmet>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-3">
          <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
            SDK install
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            Install the official KOB SDKs
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            All four official SDKs are pinned to{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">v{SDK_VERSION}</code>{" "}
            and published to public registries. Pick your language, copy the
            install command, and paste the init snippet.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer/guides/sdks">
                <BookOpen className="h-4 w-4 mr-1.5" />
                SDK guides
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer/api-explorer">
                <Package className="h-4 w-4 mr-1.5" />
                Try the API
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/status">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Status page
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6">
          {SDKS.map((sdk) => (
            <Card key={sdk.packageName} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{sdk.language}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs px-2 py-0.5 rounded bg-muted">
                        {sdk.packageName}
                      </code>
                      <Badge variant="secondary" className="text-[10px]">
                        v{SDK_VERSION}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {sdk.registry}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={sdk.registryUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        {sdk.registry}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={sdk.repoUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        GitHub
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={sdk.docsRoute}>
                        <BookOpen className="h-4 w-4 mr-1.5" />
                        Docs
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Install
                  </p>
                  <div className="grid gap-2">
                    {sdk.installCommands.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {c.label}
                          </Badge>
                          <code className="text-xs truncate">{c.cmd}</code>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(c.cmd)}
                          aria-label={`Copy ${c.label} install command`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Initialize ({sdk.importSnippet.language})
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(sdk.importSnippet.code)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                  <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
                    <code>{sdk.importSnippet.code}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verifying the published version</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              All SDKs are released together. To confirm you have v{SDK_VERSION}:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                npm:{" "}
                <code className="text-xs">npm view @kangopenbanking/sdk version</code>
              </li>
              <li>
                PyPI:{" "}
                <code className="text-xs">pip show kangopenbanking</code>
              </li>
              <li>
                Packagist:{" "}
                <code className="text-xs">composer show kangopenbanking/sdk</code>
              </li>
              <li>
                Go:{" "}
                <code className="text-xs">go list -m github.com/kangopenbanking/sdk-go</code>
              </li>
            </ul>
            <p>
              Release notes for every SDK version live in the{" "}
              <Link to="/developer/changelog" className="text-primary underline">
                public changelog
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <AutoDocNavigation />
      </div>
    </>
  );
}
