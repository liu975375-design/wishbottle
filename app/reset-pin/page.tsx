import { ResetPinForm } from "@/app/components/ResetPinForm";

type ResetPinPageProps = {
  searchParams: Promise<{ result?: string }>;
};

export default async function ResetPinPage({
  searchParams,
}: ResetPinPageProps) {
  const { result } = await searchParams;

  return (
    <div className="journey-shell">
      <ResetPinForm invalidLink={result === "invalid"} />
    </div>
  );
}
