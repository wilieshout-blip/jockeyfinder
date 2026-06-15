"use client";

import { useState } from "react";
import { createRideRequest, fetchRacesForMeeting } from "../actions";
import type { RaceOption } from "../actions";
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

  const [selectedMeetingId, setSelectedMeetingId] = useState(defaults.meeting);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [isLoadingRaces, setIsLoadingRaces] = useState(false);

  async function handleMeetingChange(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setSelectedRaceId("");
    setRaces([]);
    if (!meetingId) return;
    setIsLoadingRaces(true);
    try {
      const r = await fetchRacesForMeeting(meetingId);
      setRaces(r);
    } finally {
      setIsLoadingRaces(false);
    }
  }

  const selectedRace = races.find((r) => r.id === selectedRaceId) ?? null;

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
        <Select
          id="nr-meeting"
          name="meeting_id"
          value={selectedMeetingId}
          onChange={(e) => handleMeetingChange(e.target.value)}
          required
        >
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

      {/* Race selection — shown once races load for the chosen meeting */}
      {selectedMeetingId ? (
        <div>
          <Label htmlFor="nr-race">Race</Label>
          {isLoadingRaces ? (
            <p className="mt-1 text-sm text-zinc-400">Loading races…</p>
          ) : races.length > 0 ? (
            <>
              <Select
                id="nr-race"
                value={selectedRaceId}
                onChange={(e) => setSelectedRaceId(e.target.value)}
              >
                <option value="">Any race (no specific race)</option>
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    Race {r.race_number} · {r.name}
                  </option>
                ))}
              </Select>
              {/* Hidden inputs carry race_id and race_number to the server action */}
              <input type="hidden" name="race_id" value={selectedRace?.id ?? ""} />
              <input
                type="hidden"
                name="race_number"
                value={selectedRace?.race_number ?? ""}
              />
            </>
          ) : (
            /* Fallback: no scraped races yet — let them type a number manually */
            <Input
              id="nr-race"
              name="race_number"
              type="number"
              min="1"
              max="20"
              inputMode="numeric"
              placeholder="e.g. 5"
            />
          )}
        </div>
      ) : null}

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

      <div>
        <Label htmlFor="nr-horse">Horse name</Label>
        <Input id="nr-horse" name="horse_name" placeholder="Optional but helpful" />
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
