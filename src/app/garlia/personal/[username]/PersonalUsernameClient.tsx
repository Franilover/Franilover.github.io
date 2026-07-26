"use client";
import { useParams } from "next/navigation";
import PersonalUsername from "@/domains/garlia/_legacy-public/views/personalUsername";

export default function PersonalUsernameClient() {
  const params   = useParams();
  const username = params?.username as string;
  return <PersonalUsername username={username} />;
}
