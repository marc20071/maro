
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <h1 className="mb-6 text-4xl font-bold">About Maro AI</h1>

      <p className="mb-6 leading-8 text-gray-400">
        Maro AI is an AI-powered platform designed to make
        artificial intelligence accessible, useful, and easy
        to use. Our goal is to help people learn, create,
        solve problems, explore ideas, and improve their
        productivity through AI technology.
      </p>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">
        What Maro offers
      </h2>

      <ul className="list-disc space-y-3 pl-6 text-gray-400">
        <li>AI-powered conversations and assistance.</li>
        <li>Programming and coding assistance.</li>
        <li>Creative ideas and writing assistance.</li>
        <li>Tools designed to improve productivity.</li>
      </ul>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">
        Our mission
      </h2>

      <p className="leading-8 text-gray-400">
        We believe AI should be accessible to everyone.
        Maro is being developed to provide an easy-to-use
        experience that helps people turn questions,
        ideas, and challenges into useful solutions.
      </p>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">
        Developer
      </h2>

      <p className="leading-8 text-gray-400">
        Maro AI is independently developed and maintained
        by GISUBIZO Marc.
      </p>

      <p className="mt-4 text-gray-400">
        Contact:{" "}
        <a
          href="mailto:marcgisubi@gmail.com"
          className="text-amber-400 hover:underline"
        >
          marcgisubi@gmail.com
        </a>
      </p>
    </main>
  );
}
