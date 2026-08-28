import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  FileText,
  Presentation,
  ClipboardList,
  Calendar,
  Bell,
  BookOpen,
  Bot,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: FileText, title: "AI Notes Generator", desc: "Enter a topic — get structured notes with examples, code, diagrams and MCQs." },
  { icon: Presentation, title: "AI PPT Builder", desc: "Auto-generate slide decks with title, concept, examples and summary." },
  { icon: ClipboardList, title: "Question Paper AI", desc: "Generate university-pattern papers by unit, marks and difficulty." },
  { icon: BookOpen, title: "Question Bank", desc: "Instant MCQs, short and long answers per topic — with explanations." },
  { icon: Calendar, title: "Timetable Manager", desc: "Weekly schedule with periods and classes stored permanently." },
  { icon: Bell, title: "Smart Reminders", desc: "Track meetings, submissions and exam work with priorities." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">StaffMate <span className="text-gradient">AI</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground glow-ring"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs">
          <Bot className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Powered by Lovable AI</span>
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          The <span className="text-gradient">AI workspace</span> for college faculty.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Generate notes, presentations, question papers and manage your teaching workflow —
          all in one premium, unified dashboard.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="rounded-lg gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground glow-ring"
          >
            Create free account
          </Link>
          <Link to="/auth" className="rounded-lg border border-border px-6 py-3 text-sm font-semibold">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 transition hover:glow-ring">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg gradient-brand">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        Built for every department — CS, IT, Mechanical, Civil, ECE, EEE, BBA, MBA, Arts, Science & more.
      </footer>
    </div>
  );
}
