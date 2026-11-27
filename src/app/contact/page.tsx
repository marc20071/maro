
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <h1 className="mb-6 text-4xl font-bold">Contact Us</h1>

      <p className="mb-8 leading-8 text-gray-400">
        Have a question, feedback, technical issue,
        partnership inquiry, or concern about Maro AI?
        We welcome your feedback.
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-xl font-semibold">
          Developer Contact
        </h2>

        <p className="mb-2 text-gray-400">
          Developer: GISUBIZO Marc
        </p>

        <p className="mb-2 text-gray-400">
          Platform: Maro AI
        </p>

        <p className="mb-2 text-gray-400">
          Website: maroai.vercel.app
        </p>

        <p className="text-gray-400">
          Email:{" "}
          <a
            href="mailto:marcgisubi@gmail.com"
            className="text-amber-400 hover:underline"
          >
            marcgisubi@gmail.com
          </a>
        </p>

        <a
          href="mailto:marcgisubi@gmail.com?subject=Maro%20AI%20Support"
          className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black hover:bg-amber-300"
        >
          Email Support
        </a>
      </div>

      <h2 className="mb-3 mt-10 text-2xl font-semibold">
        Support
      </h2>

      <p className="leading-8 text-gray-400">
        When contacting us about a technical issue,
        please include a description of the problem,
        the device or browser you are using, and
        screenshots if they help explain the issue.
        Never send passwords or verification codes.
      </p>
    </main>
  );
}
