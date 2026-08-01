import CricketApp from "@/components/app/CricketApp";

export default function Page({
  searchParams,
}: {
  searchParams?: { id?: string };
}) {
  return <CricketApp page="scoring" id={searchParams?.id} />;
}
