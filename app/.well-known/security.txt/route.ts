import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    [
      "Contact: mailto:Wilieshout@gmail.com",
      "Preferred-Languages: en",
      "Policy: https://www.jockeyfinder.com/privacy",
      "Canonical: https://www.jockeyfinder.com/.well-known/security.txt",
      "Expires: 2027-06-18T00:00:00.000Z",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    }
  );
}
