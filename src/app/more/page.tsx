import Link from "next/link";

const sections = [
  {
    label: "Sites",
    description: "Manage farm sites",
    href: "/sites",
  },
  {
    label: "Varieties",
    description: "Manage banana variety specs",
    href: "/varieties",
  },
  {
    label: "Clients",
    description: "Manage clients and their orders",
    href: "/clients",
  },
  {
    label: "Weight Log",
    description: "Record harvest weights by variety",
    href: "/weight-log",
  },
];

export default function MorePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">More</h1>
      <div className="space-y-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-4"
          >
            <div>
              <p className="font-medium text-gray-900">{s.label}</p>
              <p className="text-sm text-gray-500">{s.description}</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
