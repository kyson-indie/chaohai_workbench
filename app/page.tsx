import PlatformIntro from './components/PlatformIntro';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col gap-6 px-4 py-6">
      <PlatformIntro />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Hello World</h1>
        <p className="text-base text-gray-500">潮海顾问工作台 · Next.js 14 + TypeScript + Tailwind</p>
      </div>
    </main>
  );
}
