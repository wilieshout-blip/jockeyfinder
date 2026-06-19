"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "./avatar-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Profile } from "@/lib/types";

// ── Circular crop modal ───────────────────────────────────────────────────────

const CANVAS_SIZE = 300;
const CIRCLE_R = 130; // radius of the crop circle on the canvas

function CropModal({
    file,
    onConfirm,
    onCancel,
}: {
    file: File;
    onConfirm: (blob: Blob) => void;
    onCancel: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [imgLoaded, setImgLoaded] = useState(false);
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

  // Load the image from the file and auto-fit it to fill the crop circle
  useEffect(() => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
                imgRef.current = img;
                const fitScale = Math.max(
                          (CIRCLE_R * 2) / img.width,
                          (CIRCLE_R * 2) / img.height
                        );
                setScale(fitScale);
                setOffset({ x: 0, y: 0 });
                setImgLoaded(true);
        };
        img.src = url;
        return () => {
                URL.revokeObjectURL(url);
                imgRef.current = null;
                setImgLoaded(false);
        };
  }, [file]);

  // Redraw the canvas whenever position, zoom, or image changes
  useEffect(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || !imgLoaded) return;
        const ctx = canvas.getContext("2d")!;
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;

                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

                // Draw the image centred at the current offset + scale
                const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, cx - w / 2 + offset.x, cy - h / 2 + offset.y, w, h);

                // Overlay: dim everything OUTSIDE the circle using a "donut" fill path
                // (clockwise rect + counter-clockwise circle = filled ring outside circle)
                ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2, true); // true = anticlockwise = hole
                ctx.fill();

                // White border around the crop circle
                ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
        ctx.stroke();
  }, [offset, scale, imgLoaded]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
  }
    function onPointerMove(e: React.PointerEvent) {
          if (!dragging.current) return;
          const dx = e.clientX - lastPos.current.x;
          const dy = e.clientY - lastPos.current.y;
          lastPos.current = { x: e.clientX, y: e.clientY };
          setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    }
    function onPointerUp() {
          dragging.current = false;
    }
    function onWheel(e: React.WheelEvent) {
          e.preventDefault();
          setScale((s) => Math.min(8, Math.max(0.2, s - e.deltaY * 0.001)));
    }

  // Export the circular crop region to a 256x256 JPEG blob
  function confirm() {
        const img = imgRef.current;
        if (!img) return;
        const OUT = 256;
        const R = OUT / 2;
        const ratio = OUT / (CIRCLE_R * 2); // scale from display canvas to export size
      const out = document.createElement("canvas");
        out.width = OUT;
        out.height = OUT;
        const ctx = out.getContext("2d")!;
        // Clip to a circle so the exported image is a transparent circle
      ctx.beginPath();
        ctx.arc(R, R, R, 0, Math.PI * 2);
        ctx.clip();
        const w = img.width * scale * ratio;
        const h = img.height * scale * ratio;
        const x = R - w / 2 + offset.x * ratio;
        const y = R - h / 2 + offset.y * ratio;
        ctx.drawImage(img, x, y, w, h);
        out.toBlob((blob) => blob && onConfirm(blob), "image/jpeg", 0.92);
  }

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                      <h3 className="mb-1 font-display text-lg font-semibold text-ink">
                                Crop profile photo
                      </h3>
                      <p className="mb-4 text-sm text-zinc-500">
                                Drag to reposition · scroll or pinch to zoom
                      </p>
                      <canvas
                                  ref={canvasRef}
                                  width={CANVAS_SIZE}
                                  height={CANVAS_SIZE}
                                  className="mx-auto block w-full max-w-[300px] cursor-grab rounded-2xl active:cursor-grabbing"
                                  onPointerDown={onPointerDown}
                                  onPointerMove={onPointerMove}
                                  onPointerUp={onPointerUp}
                                  onPointerLeave={onPointerUp}
                                  onWheel={onWheel}
                                  style={{ touchAction: "none" }}
                                />
                      <div className="mt-5 flex justify-end gap-3">
                                <Button variant="ghost" type="button" onClick={onCancel}>
                                            Cancel
                                </Button>
                                <Button variant="accent" type="button" onClick={confirm}>
                                            Save photo
                                </Button>
                      </div>
              </div>
        </div>
      );
}

// ── Profile form ──────────────────────────────────────────────────────────────

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
  
    const [cropFile, setCropFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Track any object URL we create so we can revoke it when replaced
    const previewUrlRef = useRef<string | null>(null);
  
    const isJockey = profile.role === "jockey";
  
    /**
       * Upload a cropped blob to the avatars bucket.
          * Shows an immediate local preview while the upload is in flight.
             */
    async function uploadCrop(blob: Blob) {
          setCropFile(null);
          setUploading(true);
          setError(null);
      
          // Show an immediate object-URL preview in the avatar circle
          const preview = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = preview;
          setPhotoUrl(preview);
      
          const fd = new FormData();
          fd.append("file", blob, "avatar.jpg");
          const result = await uploadAvatar(fd);

          if (result.error || !result.url) {
                  setUploading(false);
                  setError(result.error ?? "Upload failed. Please try again.");
                  URL.revokeObjectURL(preview);
                  previewUrlRef.current = null;
                  setPhotoUrl(profile.profile_photo_url);
                  return;
          }

      URL.revokeObjectURL(preview);
      previewUrlRef.current = null;
      setPhotoUrl(result.url);
      setUploading(false);
      setSaved(true);
      router.refresh();
      
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <>
            {/* Crop modal -- shown after file selection, before upload */}
            {cropFile ? (
                    <CropModal
                                file={cropFile}
                                onConfirm={uploadCrop}
                                onCancel={() => {
                                              setCropFile(null);
                                              if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                              />
                  ) : null}
          
                <div className="space-y-5">
                        <Card>
                                  <CardBody className="space-y-5">
                                              <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                            <Avatar src={photoUrl} name={`${firstName} ${lastName}`} size="xl" />
                                                              {uploading ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                                                  <svg
                                                                          className="h-5 w-5 animate-spin text-white"
                                                                          viewBox="0 0 24 24"
                                                                          fill="none"
                                                                        >
                                                                        <circle
                                                                                                  className="opacity-25"
                                                                                                  cx="12"
                                                                                                  cy="12"
                                                                                                  r="10"
                                                                                                  stroke="currentColor"
                                                                                                  strokeWidth="4"
                                                                                                />
                                                                        <path
                                                                                                  className="opacity-75"
                                                                                                  fill="currentColor"
                                                                                                  d="M4 12a8 8 0 018-8v8H4z"
                                                                                                />
                                                  </svg>
                              </div>
                            ) : null}
                                                            </div>
                                                            <div>
                                                                            <Label htmlFor="photo">Profile photo</Label>
                                                                            <input
                                                                                                ref={fileInputRef}
                                                                                                id="photo"
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                className="block text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
                                                                                                onChange={(e) => {
                                                                                                                      const f = e.target.files?.[0];
                                                                                                                      if (f) setCropFile(f); // open crop modal instead of uploading directly
                                                                                                  }}
                                                                                              />
                                                                            <p className="mt-1 text-xs text-zinc-400">
                                                                                              Tap to choose · you'll be able to crop before saving
                                                                            </p>
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
          </>
        );
}
