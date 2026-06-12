"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Profile } from "@/lib/types";

export function ProfileForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [country, setCountry] = useState(profile.country ?? "New Zealand");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile.profile_photo_url);

  // Jockey fields.
  const [licenceType, setLicenceType] = useState(profile.licence_type ?? "race_jockey");
  const [apprentice, setApprentice] = useState(profile.apprentice);
  const [claim, setClaim] = useState(profile.apprentice_claim?.toString() ?? "");
  const [weight, setWeight] = useState(profile.riding_weight?.toString() ?? "");
  const [apprenticeWeight, setApprenticeWeight] = useState(
    profile.apprentice_riding_weight?.toString() ?? ""
  );
  const [baseRegion, setBaseRegion] = useState(profile.base_region ?? "");
  const [preferredTracks, setPreferredTracks] = useState(profile.preferred_tracks ?? "");
  const [availability, setAvailability] = useState(profile.availability_notes ?? "");

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isJockey = profile.role === "jockey";

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);

    const updates: Record<string, unknown> = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      country: country.trim() || null,
      bio: bio.trim() || null,
      profile_photo_url: photoUrl,
    };

    if (isJockey) {
      Object.assign(updates, {
        licence_type: licenceType,
        apprentice,
        apprentice_claim: apprentice && claim ? Number(claim) : null,
        riding_weight: weight ? Number(weight) : null,
        apprentice_riding_weight:
          apprentice && apprenticeWeight ? Number(apprenticeWeight) : null,
        base_region: baseRegion.trim() || null,
        preferred_tracks: preferredTracks.trim() || null,
        availability_notes: availability.trim() || null,
      });
    } else {
      Object.assign(updates, { base_region: baseRegion.trim() || null });
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={photoUrl} name={`${firstName} ${lastName}`} size="xl" />
            <div>
              <Label htmlFor="photo">Profile photo</Label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="block text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                }}
              />
              {uploading ? (
                <p className="mt-1 text-xs text-zinc-500">Uploading...</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pf-first">First name</Label>
              <Input
                id="pf-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pf-last">Last name</Label>
              <Input
                id="pf-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pf-email">Email</Label>
              <Input id="pf-email" value={email} disabled />
            </div>
            <div>
              <Label htmlFor="pf-phone">Mobile number</Label>
              <Input
                id="pf-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {profile.role === "trainer" && !profile.verified ? (
                <Hint>
                  Trainer accounts verify automatically when this matches the
                  NZTR registry.
                </Hint>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pf-country">Country</Label>
              <Input
                id="pf-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pf-region">
                {isJockey ? "Base region" : "Region / stable location"}
              </Label>
              <Input
                id="pf-region"
                value={baseRegion}
                onChange={(e) => setBaseRegion(e.target.value)}
                placeholder="Waikato"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pf-bio">Short bio</Label>
            <Textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={
                isJockey
                  ? "A few lines trainers will see on your public profile."
                  : "A few lines about you or your stable."
              }
            />
          </div>
        </CardBody>
      </Card>

      {isJockey ? (
        <Card>
          <CardBody className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Riding details
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pf-licence">Licence type</Label>
                <Select
                  id="pf-licence"
                  value={licenceType}
                  onChange={(e) => setLicenceType(e.target.value)}
                >
                  <option value="race_jockey">Race jockey</option>
                  <option value="trial_jumpout_only">Trials and jumpouts only</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="pf-weight">Riding weight (kg)</Label>
                <Input
                  id="pf-weight"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="54.5"
                />
                <Hint>Weight changes often. You can also update it from your dashboard.</Hint>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={apprentice}
                onChange={(e) => setApprentice(e.target.checked)}
                className="h-4 w-4 rounded border-line text-turf-600 focus:ring-turf-600"
              />
              I am an apprentice
            </label>

            {apprentice ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pf-claim">Apprentice claim (kg)</Label>
                  <Input
                    id="pf-claim"
                    type="number"
                    step="0.5"
                    min="0"
                    max="4"
                    inputMode="decimal"
                    value={claim}
                    onChange={(e) => setClaim(e.target.value)}
                    placeholder="3"
                  />
                  <Hint>Shown publicly as a1, a2, a3.</Hint>
                </div>
                <div>
                  <Label htmlFor="pf-aweight">Weight with claim (kg)</Label>
                  <Input
                    id="pf-aweight"
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={apprenticeWeight}
                    onChange={(e) => setApprenticeWeight(e.target.value)}
                    placeholder="51.5"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="pf-tracks">Preferred tracks or regions</Label>
              <Input
                id="pf-tracks"
                value={preferredTracks}
                onChange={(e) => setPreferredTracks(e.target.value)}
                placeholder="Te Rapa, Ellerslie, Central Districts"
              />
            </div>

            <div>
              <Label htmlFor="pf-availability">Availability notes</Label>
              <Textarea
                id="pf-availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Available most Saturdays. Happy to travel for trials midweek."
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button variant="accent" onClick={save} disabled={busy || uploading}>
          {busy ? "Saving..." : "Save profile"}
        </Button>
        {saved ? <p className="text-sm font-medium text-turf-700">Saved</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
