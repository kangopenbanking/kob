import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Cookie, Shield, BarChart3, Settings2, Gauge, Globe, Clock, ToggleRight, Mail } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

const cookieTable = [
  { name: "sb-access-token", purpose: "Authentication session", type: "Essential", duration: "Session", provider: "KOB" },
  { name: "sb-refresh-token", purpose: "Session refresh", type: "Essential", duration: "7 days", provider: "KOB" },
  { name: "sidebar:state", purpose: "Dashboard layout preference", type: "Functional", duration: "7 days", provider: "KOB" },
  { name: "kob_cookie_consent", purpose: "Cookie consent choice", type: "Essential", duration: "365 days", provider: "KOB" },
  { name: "kob_cookie_preferences", purpose: "Cookie preference settings", type: "Essential", duration: "365 days", provider: "KOB" },
  { name: "theme", purpose: "Dark/light mode preference", type: "Functional", duration: "365 days", provider: "KOB" },
  { name: "_ga / _gid", purpose: "Traffic analysis & user journeys", type: "Analytics", duration: "2 years / 24h", provider: "Google" },
  { name: "__cf_bm", purpose: "Bot detection & CDN routing", type: "Performance", duration: "30 min", provider: "Cloudflare" },
  { name: "__stripe_mid", purpose: "Payment fraud prevention", type: "Essential", duration: "1 year", provider: "Stripe" },
];

const categories = [
  {
    icon: Shield, title: "Essential Cookies", color: "text-primary", bg: "bg-primary/10",
    desc: "Required for authentication, security, fraud prevention, and core platform functionality. These cannot be disabled as the platform cannot operate without them.",
    examples: ["User authentication & session tokens", "CSRF protection & security headers", "Cookie consent preferences", "Payment processing security", "Load balancing & routing"],
  },
  {
    icon: Settings2, title: "Functional Cookies", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950/40",
    desc: "Remember your preferences and personalise your experience across sessions. Disabling these means settings like theme, language, and layout won't persist.",
    examples: ["Dark/light mode theme selection", "Dashboard sidebar state", "Language & locale preferences", "Table column visibility settings", "Notification display preferences"],
  },
  {
    icon: BarChart3, title: "Analytics Cookies", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950/40",
    desc: "Help us understand how users interact with the platform so we can improve features, fix usability issues, and prioritise development. All data is anonymised.",
    examples: ["Page visit frequency & duration", "Feature adoption rates", "User journey flow analysis", "A/B test variant assignment", "Error rate tracking by feature"],
  },
  {
    icon: Gauge, title: "Performance Cookies", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40",
    desc: "Monitor system performance, API response times, and error rates to ensure we deliver a fast, reliable experience. No personal data is collected.",
    examples: ["API endpoint latency measurement", "Page load time monitoring", "Client-side error logging", "CDN cache hit/miss ratios", "Resource loading optimisation"],
  },
];

export default function Cookies() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Cookie Policy | Kang Open Banking" description="Comprehensive cookie policy explaining how Kang Open Banking uses cookies, your choices, and how to manage preferences." />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/3 py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full bg-primary blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 px-4 py-1.5 text-xs font-semibold">
              <Cookie className="h-3.5 w-3.5 mr-1.5" /> Legal
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-4">Cookie Policy</h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              We believe in full transparency about how we use cookies. This policy explains what cookies are, which ones we use, why, and how you control them.
            </p>
            <p className="text-sm text-muted-foreground mt-4">Last updated: March 21, 2026</p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-4xl py-16 space-y-16">

        {/* 1. What Are Cookies */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> 1. What Are Cookies?
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Cookies are small text files placed on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites work efficiently, provide a better user experience, and supply information to site owners. Cookies may be set by the website you are visiting ("first-party cookies") or by third parties whose services the website uses ("third-party cookies").
          </p>
        </motion.section>

        {/* 2. Cookie Categories */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" /> 2. Types of Cookies We Use
          </h2>
          <div className="grid gap-5">
            {categories.map((cat, i) => (
              <motion.div key={cat.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="border border-border/60 rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`h-10 w-10 rounded-xl ${cat.bg} flex items-center justify-center shrink-0`}>
                    <cat.icon className={`h-5 w-5 ${cat.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{cat.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{cat.desc}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 ml-14">
                  {cat.examples.map((ex) => (
                    <div key={ex} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      {ex}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* 3. Cookie Inventory Table */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" /> 3. Cookie Inventory
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Cookie Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Purpose</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Provider</th>
                </tr>
              </thead>
              <tbody>
                {cookieTable.map((c, i) => (
                  <tr key={c.name} className={`border-t border-border/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="py-3 px-4 font-mono text-xs text-foreground">{c.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.purpose}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-semibold">{c.type}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{c.duration}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* 4. Third-Party Cookies */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}>
          <h2 className="text-2xl font-bold text-foreground mb-4">4. Third-Party Cookies</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. The third parties listed below have their own privacy and cookie policies:
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: "Google Analytics", purpose: "Anonymous website analytics", link: "https://policies.google.com/technologies/cookies" },
              { name: "Cloudflare", purpose: "Security, CDN & bot protection", link: "https://www.cloudflare.com/cookie-policy/" },
              { name: "Stripe", purpose: "Payment processing security", link: "https://stripe.com/cookies-policy/legal" },
            ].map((tp) => (
              <div key={tp.name} className="border border-border/60 rounded-xl p-4 hover:shadow-md transition-shadow">
                <h4 className="font-semibold text-foreground text-sm mb-1">{tp.name}</h4>
                <p className="text-xs text-muted-foreground mb-2">{tp.purpose}</p>
                <a href={tp.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  View their cookie policy →
                </a>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 5. Cookie Duration */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4}>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> 5. Cookie Duration
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="border border-border/60 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">Session Cookies</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Temporary cookies that are deleted when you close your browser. Used for authentication tokens and CSRF protection during your active session.
              </p>
            </div>
            <div className="border border-border/60 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">Persistent Cookies</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Remain on your device until they expire or you delete them manually. Used for preferences, consent records, and analytics (typically 1–24 months).
              </p>
            </div>
          </div>
        </motion.section>

        {/* 6. Managing Cookies */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={5}>
          <h2 className="text-2xl font-bold text-foreground mb-4">6. Managing Your Cookie Preferences</h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-foreground mb-2">6.1 Our Consent Banner</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you first visit our website, a cookie consent banner appears in the bottom-left corner. You can accept all cookies, reject non-essential cookies, or customise your preferences by toggling individual categories. Your choice is saved for 365 days.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">6.2 Browser Settings</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                You can also control cookies through your browser settings. Note that blocking essential cookies may prevent the platform from functioning correctly.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { browser: "Chrome", path: "Settings → Privacy and Security → Cookies and other site data" },
                  { browser: "Firefox", path: "Settings → Privacy & Security → Cookies and Site Data" },
                  { browser: "Safari", path: "Preferences → Privacy → Manage Website Data" },
                  { browser: "Edge", path: "Settings → Cookies and site permissions → Manage and delete cookies" },
                ].map((b) => (
                  <div key={b.browser} className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-foreground text-sm">{b.browser}</p>
                    <p className="text-xs text-muted-foreground">{b.path}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">6.3 Resetting Consent</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To change your cookie preferences, clear the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">kob_cookie_consent</code> item from your browser's local storage, or clear your browser cookies for this site. The consent banner will reappear on your next visit.
              </p>
            </div>
          </div>
        </motion.section>

        {/* 7. Do Not Track */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={6}>
          <h2 className="text-2xl font-bold text-foreground mb-4">7. Do Not Track (DNT)</h2>
          <p className="text-muted-foreground leading-relaxed">
            We respect the Do Not Track browser signal. When DNT is enabled, we automatically disable analytics and performance cookies. Essential and functional cookies remain active as they are necessary for core platform operation and your preferences.
          </p>
        </motion.section>

        {/* 8. Impact */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={7}>
          <h2 className="text-2xl font-bold text-foreground mb-4">8. Impact of Disabling Cookies</h2>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">Disabling non-essential cookies will not affect core platform functionality, but may result in:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Your theme, language, and layout preferences may not persist between sessions",
                "We won't be able to improve the platform based on usage analytics",
                "Performance optimisation may be limited as we can't monitor load times",
                "You may see the cookie consent banner repeatedly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* 9. Legal Basis */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={8}>
          <h2 className="text-2xl font-bold text-foreground mb-4">9. Legal Basis</h2>
          <p className="text-muted-foreground leading-relaxed">
            We process cookie data under the following legal bases as applicable under EU GDPR, CEMAC data protection regulations, and PIPEDA (Canada):
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" /><strong className="text-foreground">Essential cookies:</strong> Legitimate interest — necessary for platform operation</li>
            <li className="flex items-start gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" /><strong className="text-foreground">Functional/Analytics/Performance:</strong> Consent — you choose whether to enable these via our consent banner</li>
          </ul>
        </motion.section>

        {/* 10. Updates */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={9}>
          <h2 className="text-2xl font-bold text-foreground mb-4">10. Updates to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Cookie Policy periodically to reflect changes in technology, regulation, or our practices. Significant changes will be communicated via a renewed consent banner and/or email notification to registered users. We encourage you to review this page regularly.
          </p>
        </motion.section>

        {/* 11. Related Policies */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={10}>
          <h2 className="text-2xl font-bold text-foreground mb-4">11. Related Policies</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: "Privacy Policy", to: "/privacy", desc: "How we collect and use personal data" },
              { label: "Terms of Service", to: "/terms", desc: "Platform usage terms and conditions" },
              { label: "Data Protection", to: "/data-protection", desc: "GDPR & CEMAC data protection framework" },
            ].map((p) => (
              <Link key={p.to} to={p.to} className="border border-border/60 rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all group">
                <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* 12. Contact */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={11}
          className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">12. Contact Us</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                If you have questions about our use of cookies or wish to exercise your data rights, contact our Data Protection Officer:
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-foreground font-medium">Email: privacy@kangopenbanking.com</p>
                <p className="text-foreground font-medium">Phone: +237 6 22 02 25 67</p>
                <p className="text-muted-foreground">Kang Consultancy Co Ltd, Port Dover, ON, Canada</p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
