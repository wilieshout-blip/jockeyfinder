"use client";

import { createRideRequest } from "../actions";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { formatMeetingDate } from "@/lib/utils";
import type { Meeting, Role } from "@/lib/types";

interface Option {
  id: string;
  label: string;
}

export function NewRequestForm({
  role,
  meetings,
  counterparts,
  managedJockeys,
  defaults,
}: {
  role: Role;
  meetings: Meeting[];
  counterparts: Option[];
  managedJockeys: Option[];
  defaults: { meeting: string; counterpart: string; managedJockey: string };
}) {
  const counterpartLabel = role === "trainer" ? "Jockey" : "Trainer";

  return (
    <form
      action={createRideRequest}
      className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card"
    >
      {role === "agent" ? (
        <div>
          <Label htmlFor="nr-managed">Riding jockey</Label>
          <Select
            id="nr-managed"
            name="managed_jockey_id"
            defaultValue={defaults.managedJockey}
            required
          >
            <option value="" disabled>
              Choose one of your jockeys
            </option>
            {managedJockeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </Select>
          {managedJockeys.length === 0 ? (
            <Hint>You have no jockeys linked yet. Add them on the My Jockeys page first.</Hint>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor="nr-meeting">Meeting</Label>
        <Select id="nr-meeting" name="meeting_id" defaultValue={defaults.meeting} required>
          <option value="" disabled>
            Choose a meeting
          </option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {formatMeetingDate(m.meeting_date)} · {m.track}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="nr-counterpart">{counterpartLabel}</Label>
        <Select
          id="nr-counterpart"
          name="counterpart_id"
          defaultValue={defaults.counterpart}
          required
        >
          <option value="" disabled>
            Choose a verified {counterpartLabel.toLowerCase()}
          </option>
          {counterparts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <Label htmlFor="nr-horse">Horse name</Label>
          <Input id="nr-horse" name="horse_name" placeholder="Optional but helpful" />
        </div>
        <div>
          <Label htmlFor="nr-race">Race no.</Label>
          <Input
            id="nr-race"
            name="race_number"
            type="number"
            min="1"
            max="12"
            inputMode="numeric"
            placeholder="5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="nr-note">Note</Label>
        <Textarea
          id="nr-note"
          name="note"
          placeholder={
            role === "trainer"
              ? "Carries 56kg, drawn wide last start, suits a patient ride."
              : "Keen for the ride. Can make the weight comfortably."
          }
        />
      </div>

      <Button type="submit" variant="accent" className="w-full">
        Send request
      </Button>
    </form>
  );
}
