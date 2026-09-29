"use client";

import { useEffect, useRef, useState } from "react";

export default function SignupForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const requestId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const prefill = (event: Event) => {
      if (sending.current || !formRef.current) return;
      const { city, role } = (event as CustomEvent).detail || {};
      const cityInput = formRef.current.elements.namedItem("city") as HTMLInputElement;
      const roleInput = formRef.current.elements.namedItem("role") as HTMLSelectElement;
      if (typeof city === "string" && city.length <= 120 && !cityInput.value) cityInput.value = city;
      if (["passenger", "driver"].includes(role) && !roleInput.value) roleInput.value = role;
      requestId.current = null;
    };
    window.addEventListener("voyaj-prefill", prefill);
    return () => window.removeEventListener("voyaj-prefill", prefill);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    sending.current = true;
    setStatus("sending");
    setMessage("");
    const data = new FormData(form);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), city: data.get("city"),
          role: data.get("role"), consent: data.get("consent") === "on",
          website: data.get("website"), requestId: requestId.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "L’envoi n’a pas abouti. Réessayez dans un instant.");
      setStatus("success");
      setMessage("Merci ! Votre demande a été envoyée à l’équipe Voyaj. Nous vous préviendrons du lancement.");
      form.reset();
      requestId.current = null;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.name !== "TimeoutError"
        ? error.message : "L’envoi prend plus de temps que prévu. Vous pouvez réessayer.");
    } finally {
      sending.current = false;
    }
  }

  return (
    <form ref={formRef} className="signup-form" onSubmit={submit} aria-label="Inscription au lancement de Voyaj"
      onChange={() => { if (!sending.current) requestId.current = null; }}>
      <fieldset disabled={status === "sending"}>
        <legend>Prévenez-moi du lancement</legend>
        <p className="signup-intro">Quelques informations pour vous prévenir quand Voyaj arrive près de chez vous.</p>
        <div className="signup-fields">
          <label>Votre prénom<input name="name" autoComplete="given-name" required maxLength={80} placeholder="Prénom" /></label>
          <label>Votre commune<input name="city" autoComplete="address-level2" required maxLength={120} placeholder="Commune ou ville" /></label>
          <label className="signup-wide">Votre adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="vous@exemple.fr" /></label>
        </div>
        <label className="signup-role">Je souhaite utiliser Voyaj comme
          <select name="role" defaultValue="" required>
            <option value="" disabled>Choisir mon profil</option>
            <option value="passenger">Passager</option>
            <option value="driver">Conducteur</option>
            <option value="both">Conducteur et passager</option>
          </select>
        </label>
        <div className="signup-trap" aria-hidden="true">
          <label>Site internet<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <label className="signup-consent"><input name="consent" type="checkbox" required />
          <span>J’accepte que l’équipe Voyaj utilise ces informations pour me prévenir du lancement de la campagne et de l’application.</span>
        </label>
        <button className="btn btn-primary" type="submit">{status === "sending" ? "Envoi en cours…" : "Me prévenir du lancement →"}</button>
      </fieldset>
      <p className={`signup-feedback ${status}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
