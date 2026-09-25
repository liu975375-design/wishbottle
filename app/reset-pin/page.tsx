import { ResetPinForm } from "@/app/components/ResetPinForm";

type ResetPinPageProps = {
  searchParams: Promise<{ result?: string }>;
};

export default async function ResetPinPage({
  searchParams,
}: ResetPinPageProps) {
  const { result } = await searchParams;
  const linkState =
    result === "expired" || result === "used" || result === "invalid"
      ? result
      : "valid";

  return (
    <div className="journey-shell">
      <ResetPinForm linkState={linkState} />
    </div>
  );
}
