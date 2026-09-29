"use client";

import { useActionState, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { calculateGrowthProjection, calculateIncomePlan } from "@/lib/financial/income-plan";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import type {
  IncomePlan,
  IncomePlanEarningUnit,
  IncomePlanGrowthFocus,
  SkillCategory,
  UserSkill,
} from "@/types/database";
import { createIncomePlan, activateIncomePlan, deleteIncomePlan } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UNITS: IncomePlanEarningUnit[] = ["hour", "person", "session", "job", "item"];
const GROWTH_FOCUSES: IncomePlanGrowthFocus[] = ["steady", "more_clients", "raise_rate", "scale"];

const EXAMPLES: Array<{ key: string; interest: string; offer: string; category: SkillCategory; unit: IncomePlanEarningUnit; rate: string }> = [
  { key: "teach", interest: "teach", offer: "tutor", category: "teaching", unit: "person", rate: "200" },
  { key: "design", interest: "design", offer: "socialDesign", category: "design", unit: "job", rate: "500" },
  { key: "video", interest: "video", offer: "shortVideo", category: "video_editing", unit: "job", rate: "800" },
];

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function IncomePathPlanner({
  plans,
  skills,
  currencyCode,
  locale,
}: {
  plans: IncomePlan[];
  skills: UserSkill[];
  currencyCode: string;
  locale: "th" | "en";
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(plans.length === 0);
  const [interest, setInterest] = useState("");
  const [offer, setOffer] = useState("");
  const [skillId, setSkillId] = useState("");
  const [category, setCategory] = useState<SkillCategory>("other");
  const [unit, setUnit] = useState<IncomePlanEarningUnit>("hour");
  const [rate, setRate] = useState("200");
  const [unitsPerWeek, setUnitsPerWeek] = useState("5");
  const [hoursPerUnit, setHoursPerUnit] = useState("1");
  const [weeksPerYear, setWeeksPerYear] = useState("48");
  const [growthFocus, setGrowthFocus] = useState<IncomePlanGrowthFocus>("steady");
  const [state, action, pending] = useActionState(createIncomePlan, undefined);

  const assumptions = useMemo(() => ({
    ratePerUnitCents: Math.max(0, Math.round(numberValue(rate) * 100)),
    unitsPerWeek: Math.max(0, numberValue(unitsPerWeek)),
    hoursPerUnit: Math.max(0, numberValue(hoursPerUnit)),
    activeWeeksPerYear: Math.min(52, Math.max(0, numberValue(weeksPerYear))),
  }), [rate, unitsPerWeek, hoursPerUnit, weeksPerYear]);
  const projection = useMemo(() => calculateIncomePlan(assumptions), [assumptions]);
  const growth = useMemo(() => calculateGrowthProjection(assumptions, growthFocus), [assumptions, growthFocus]);
  const format = (cents: number, digits = 0) => formatMoney(cents, currencyCode, locale === "th" ? "th-TH" : "en-US", digits);

  function selectSkill(id: string) {
    const skill = skills.find((item) => item.id === id);
    setSkillId(id);
    if (!skill) return;
    setInterest(skill.skill_name);
    setCategory(skill.category);
    if (!offer) setOffer(skill.skill_name);
  }

  function applyExample(example: (typeof EXAMPLES)[number]) {
    setSkillId("");
    setInterest(t(`earn.planner.examples.${example.interest}`));
    setOffer(t(`earn.planner.examples.${example.offer}`));
    setCategory(example.category);
    setUnit(example.unit);
    setRate(example.rate);
  }

  return (
    <section className="space-y-4" aria-labelledby="income-planner-title">
      <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(145deg,var(--color-primary),color-mix(in_oklab,var(--color-primary)_78%,black))] text-primary-foreground shadow-lg">
        <CardContent className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-white/8" />
          <div className="pointer-events-none absolute right-20 -bottom-20 size-40 rounded-full bg-white/5" />
          <div className="relative flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Heart className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Badge className="mb-2 border-white/20 bg-white/12 text-white hover:bg-white/12">
                <Sparkles className="size-3" aria-hidden="true" />
                {t("earn.planner.eyebrow")}
              </Badge>
              <h2 id="income-planner-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t("earn.planner.title")}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-primary-foreground/75">
                {t("earn.planner.description")}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
              >
                {expanded ? t("earn.planner.hidePlanner") : t("earn.planner.startPlanning")}
                {expanded ? <ChevronDown className="rotate-180" /> : <ArrowRight />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded ? (
        <form action={action} className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <Card>
            <CardContent className="space-y-6 p-4 sm:p-5">
              <div className="space-y-3">
                <StepLabel number="1" title={t("earn.planner.stepInterest")} />
                {skills.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {skills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => selectSkill(skill.id)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          skillId === skill.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                        )}
                      >
                        {skill.skill_name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="income-plan-interest">{t("earn.planner.interestLabel")}</Label>
                    <Input
                      id="income-plan-interest"
                      name="interest_name"
                      value={interest}
                      onChange={(event) => setInterest(event.target.value)}
                      placeholder={t("earn.planner.interestPlaceholder")}
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-plan-offer">{t("earn.planner.offerLabel")}</Label>
                    <Input
                      id="income-plan-offer"
                      name="offer_name"
                      value={offer}
                      onChange={(event) => setOffer(event.target.value)}
                      placeholder={t("earn.planner.offerPlaceholder")}
                      maxLength={100}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button key={example.key} type="button" onClick={() => applyExample(example)} className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                      {t(`earn.planner.examples.${example.interest}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t pt-5">
                <StepLabel number="2" title={t("earn.planner.stepNumbers")} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-2 space-y-2 sm:col-span-1">
                    <Label htmlFor="income-plan-unit">{t("earn.planner.unitLabel")}</Label>
                    <Select name="earning_unit" value={unit} onValueChange={(value) => value && setUnit(value as IncomePlanEarningUnit)}>
                      <SelectTrigger id="income-plan-unit"><SelectValue>{(value: string) => t(`earn.planner.units.${value}`)}</SelectValue></SelectTrigger>
                      <SelectContent>{UNITS.map((item) => <SelectItem key={item} value={item}>{t(`earn.planner.units.${item}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <NumberField id="income-plan-rate" name="rate_per_unit" label={t("earn.planner.rateLabel")} value={rate} setValue={setRate} min="1" />
                  <NumberField id="income-plan-units" name="units_per_week" label={t("earn.planner.unitsPerWeek")} value={unitsPerWeek} setValue={setUnitsPerWeek} min="0.1" step="0.5" />
                  <NumberField id="income-plan-hours" name="hours_per_unit" label={t("earn.planner.hoursPerUnit")} value={hoursPerUnit} setValue={setHoursPerUnit} min="0.1" step="0.5" />
                </div>
              </div>

              <div className="space-y-3 border-t pt-5">
                <StepLabel number="3" title={t("earn.planner.stepFuture")} />
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <NumberField id="income-plan-weeks" name="active_weeks_per_year" label={t("earn.planner.weeksPerYear")} value={weeksPerYear} setValue={setWeeksPerYear} min="1" step="1" max="52" />
                  <div className="space-y-2">
                    <Label>{t("earn.planner.growthLabel")}</Label>
                    <input type="hidden" name="growth_focus" value={growthFocus} />
                    <div className="grid grid-cols-2 gap-2">
                      {GROWTH_FOCUSES.map((focus) => (
                        <button
                          key={focus}
                          type="button"
                          onClick={() => setGrowthFocus(focus)}
                          className={cn(
                            "rounded-xl border p-2.5 text-left text-xs transition-colors",
                            growthFocus === focus ? "border-primary bg-primary/8 text-foreground" : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {growthFocus === focus ? <Check className="size-3.5 text-primary" /> : null}
                            {t(`earn.planner.growth.${focus}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <input type="hidden" name="skill_id" value={skillId} />
              <input type="hidden" name="category" value={category} />
              {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
              {state?.success ? <p role="status" className="text-sm text-primary">{t("earn.planner.saved")}</p> : null}
              <Button type="submit" className="w-full" disabled={pending || !interest.trim() || !offer.trim()}>
                <Plus aria-hidden="true" />
                {pending ? t("common.saving") : t("earn.planner.savePlan")}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-0">
                <div className="bg-primary/8 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary"><Calculator className="size-4" />{t("earn.planner.liveEstimate")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{format(projection.monthlyIncomeCents)}</p>
                  <p className="text-xs text-muted-foreground">{t("earn.planner.perMonthEstimate")}</p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <Metric icon={TrendingUp} label={t("earn.planner.perYear")} value={format(projection.yearlyIncomeCents)} />
                  <Metric icon={Clock3} label={t("earn.planner.timePerMonth")} value={`${projection.monthlyHours.toFixed(1)} ${t("earn.planner.hoursShort")}`} />
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">{t("earn.planner.estimateDisclaimer")}</p>
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold"><Rocket className="size-4 text-primary" />{t("earn.planner.nextLevel")}</p>
                    <p className="mt-1 text-sm">{t(`earn.planner.growthDescriptions.${growthFocus}`)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("earn.planner.growthCouldReach")} <strong className="text-foreground">{format(growth.monthlyIncomeCents)}</strong>/{t("earn.planner.monthShort")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      ) : null}

      {plans.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{t("earn.planner.savedPlans")}</h3>
              <p className="text-xs text-muted-foreground">{t("earn.planner.savedPlansDescription")}</p>
            </div>
            <Badge variant="secondary">{plans.length}</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {plans.map((plan) => (
              <SavedPlanCard key={plan.id} plan={plan} currencyCode={currencyCode} locale={locale} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StepLabel({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><h3 className="font-semibold">{title}</h3></div>;
}

function NumberField({ id, name, label, value, setValue, min, max, step = "any" }: { id: string; name: string; label: string; value: string; setValue: (value: string) => void; min: string; max?: string; step?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} type="number" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} min={min} max={max} step={step} required /></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return <div className="bg-card p-3.5"><p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="size-3.5" />{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function SavedPlanCard({ plan, currencyCode, locale }: { plan: IncomePlan; currencyCode: string; locale: "th" | "en" }) {
  const { t } = useTranslation();
  const projection = calculateIncomePlan({
    ratePerUnitCents: parseMoneyToCents(plan.rate_per_unit),
    unitsPerWeek: Number(plan.units_per_week),
    hoursPerUnit: Number(plan.hours_per_unit),
    activeWeeksPerYear: plan.active_weeks_per_year,
  });
  const money = formatMoney(projection.monthlyIncomeCents, currencyCode, locale === "th" ? "th-TH" : "en-US", 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{plan.interest_name}</p>
            <h4 className="truncate font-semibold">{plan.offer_name}</h4>
          </div>
          <form action={deleteIncomePlan.bind(null, plan.id)}>
            <Button type="submit" size="icon-sm" variant="ghost" aria-label={t("earn.planner.deletePlan")}><Trash2 className="size-4" /></Button>
          </form>
        </div>
        <div className="mt-3 flex items-end justify-between rounded-xl bg-muted/55 p-3">
          <div><p className="text-xs text-muted-foreground">{t("earn.planner.estimatedMonthly")}</p><p className="text-lg font-bold">{money}</p></div>
          <p className="text-xs text-muted-foreground">{projection.monthlyHours.toFixed(1)} {t("earn.planner.hoursShort")}/{t("earn.planner.monthShort")}</p>
        </div>
        <div className="mt-3">
          {plan.income_source_id ? (
            <Badge variant="secondary"><Check className="size-3" />{t("earn.planner.activated")}</Badge>
          ) : (
            <form action={activateIncomePlan.bind(null, plan.id)}>
              <Button type="submit" variant="outline" size="sm" className="w-full">
                {t("earn.planner.activatePlan")}<ArrowRight className="size-4" />
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
