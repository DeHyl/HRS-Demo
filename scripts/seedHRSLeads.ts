/**
 * seedHRSLeads.ts
 * Seeds 15 realistic HRS-profile leads (aerospace, medical devices, automotive,
 * industrial equipment) with real contact names, titles, and HRS-relevant pain points.
 *
 * Run with: npx tsx scripts/seedHRSLeads.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { leads, sdrs, researchPackets } from "../shared/schema";
import { sql, eq } from "drizzle-orm";

const HRS_LEADS = [
  {
    companyName: "Ducommun Incorporated",
    contactName: "Keith Weston",
    contactTitle: "Director of Engineering",
    contactEmail: "kweston@ducommun.com",
    contactPhone: "+1 (714) 629-5600",
    contactLinkedIn: "https://linkedin.com/in/keith-weston-engineer",
    companyWebsite: "https://www.ducommun.com",
    companyIndustry: "Aerospace & Defense",
    companySize: "2,500",
    companyDescription: "Structural assemblies, electronic systems, and components for aerospace and defense. Supplies Boeing, Lockheed Martin, and Raytheon.",
    source: "manual",
    status: "new",
    fitScore: 91,
    priority: "hot",
    painPoints: ["2D AutoCAD still used for structural drawings", "No PDM — files on shared network drives", "Physical prototypes failing stress tests late in development"],
  },
  {
    companyName: "Natel Engineering",
    contactName: "Sandra Cho",
    contactTitle: "VP of Manufacturing Engineering",
    contactEmail: "scho@nateleng.com",
    contactPhone: "+1 (818) 734-6500",
    contactLinkedIn: "https://linkedin.com/in/sandra-cho-manufacturing",
    companyWebsite: "https://www.nateleng.com",
    companyIndustry: "Electronics Manufacturing",
    companySize: "1,200",
    companyDescription: "Electronics manufacturing services (EMS) for aerospace, defense, and industrial sectors. PCB assemblies and complex integrated systems.",
    source: "manual",
    status: "contacted",
    fitScore: 84,
    priority: "hot",
    painPoints: ["Inventor licenses expiring — evaluating SOLIDWORKS migration", "No simulation toolchain for thermal validation", "5-axis CNC programming done manually"],
  },
  {
    companyName: "Aerojet Rocketdyne (L3Harris)",
    contactName: "James Thornton",
    contactTitle: "CAD/PLM Systems Manager",
    contactEmail: "jthornton@l3harris.com",
    contactPhone: "+1 (321) 727-9100",
    contactLinkedIn: "https://linkedin.com/in/james-thornton-plm",
    companyWebsite: "https://www.l3harris.com",
    companyIndustry: "Aerospace & Defense",
    companySize: "47,000",
    companyDescription: "Defense electronics, space systems, and communication equipment. Supplier to US DoD and NASA.",
    source: "manual",
    status: "qualified",
    fitScore: 88,
    priority: "hot",
    painPoints: ["SOLIDWORKS PDM rollout stalled across 3 sites", "Engineering change orders take 2+ weeks", "AS9100 audit failed on document control"],
  },
  {
    companyName: "Integer Holdings",
    contactName: "Patricia Nguyen",
    contactTitle: "Sr. Design Engineer",
    contactEmail: "pnguyen@integer.net",
    contactPhone: "+1 (972) 281-5100",
    contactLinkedIn: "https://linkedin.com/in/patricia-nguyen-meddevice",
    companyWebsite: "https://www.integer.net",
    companyIndustry: "Medical Devices",
    companySize: "6,000",
    companyDescription: "World's largest medical device outsource manufacturer. Produces batteries, components, and assemblies for cardiac rhythm management, neurostimulation, and surgical tools.",
    source: "manual",
    status: "new",
    fitScore: 86,
    priority: "hot",
    painPoints: ["FDA 21 CFR Part 11 traceability gaps in design history file", "Multiple CAD platforms across acquired companies (NX, Creo, SOLIDWORKS)", "Physical fatigue testing costing $200K/year in prototype builds"],
  },
  {
    companyName: "Kapco Global",
    contactName: "Robert Finley",
    contactTitle: "Manufacturing Engineering Manager",
    contactEmail: "rfinley@kapcoglobal.com",
    contactPhone: "+1 (330) 673-4900",
    contactLinkedIn: "https://linkedin.com/in/robert-finley-aerospace",
    companyWebsite: "https://www.kapcoglobal.com",
    companyIndustry: "Aerospace & Defense",
    companySize: "850",
    companyDescription: "Aerospace sheet metal fabrication, kitting, and supply chain management. MRO and manufacturing for Boeing and Airbus programs.",
    source: "manual",
    status: "contacted",
    fitScore: 79,
    priority: "warm",
    painPoints: ["Mastercam seats expensive — evaluating alternatives", "No scan-to-CAD capability for reverse engineering legacy parts", "Manual toolpath programming for 5 CNC machines"],
  },
  {
    companyName: "Orchid Orthopedic Solutions",
    contactName: "Dr. Michelle Park",
    contactTitle: "Director of R&D Engineering",
    contactEmail: "mpark@orchid-ortho.com",
    contactPhone: "+1 (517) 279-5000",
    contactLinkedIn: "https://linkedin.com/in/michelle-park-orthopedics",
    companyWebsite: "https://www.orchid-ortho.com",
    companyIndustry: "Medical Devices",
    companySize: "3,500",
    companyDescription: "Contract manufacturer of orthopedic implants — hips, knees, and spinal devices. Serves 300+ OEM customers worldwide.",
    source: "manual",
    status: "new",
    fitScore: 89,
    priority: "hot",
    painPoints: ["Simulation needed for implant fatigue validation pre-submission", "SOLIDWORKS seats underutilized — no FEA workflow", "ISO 13485 audit prep consuming 3 engineers for 2 months"],
  },
  {
    companyName: "Martinrea International",
    contactName: "Carlos Espinoza",
    contactTitle: "CAD Systems Administrator",
    contactEmail: "cespinoza@martinrea.com",
    contactPhone: "+1 (905) 264-4100",
    contactLinkedIn: "https://linkedin.com/in/carlos-espinoza-automotive",
    companyWebsite: "https://www.martinrea.com",
    companyIndustry: "Automotive",
    companySize: "15,000",
    companyDescription: "Tier 1 automotive supplier — lightweight structural assemblies, fluid management, and propulsion components for Ford, GM, and Stellantis.",
    source: "manual",
    status: "contacted",
    fitScore: 82,
    priority: "hot",
    painPoints: ["CATIA V5 migration to 3DEXPERIENCE stalled — evaluating SOLIDWORKS instead", "20 unmanaged PDM vault copies causing revision chaos", "IATF 16949 documentation control failing third-party audit"],
  },
  {
    companyName: "Proto Labs (Protolabs)",
    contactName: "Angela Morrison",
    contactTitle: "Applications Engineering Lead",
    contactEmail: "amorrison@protolabs.com",
    contactPhone: "+1 (763) 479-3680",
    contactLinkedIn: "https://linkedin.com/in/angela-morrison-protolabs",
    companyWebsite: "https://www.protolabs.com",
    companyIndustry: "Industrial Equipment",
    companySize: "2,800",
    companyDescription: "Digital manufacturing services — CNC machining, injection molding, 3D printing, and sheet metal fabrication on demand.",
    source: "manual",
    status: "qualified",
    fitScore: 76,
    priority: "warm",
    painPoints: ["Customers requesting SLA quote integration with SOLIDWORKS model upload", "Internal 3D printing fleet aging — evaluating Markforged composite upgrade", "Geomagic inspection workflow needed for first article reporting"],
  },
  {
    companyName: "Curtiss-Wright Corporation",
    contactName: "Thomas Reeves",
    contactTitle: "Principal Mechanical Engineer",
    contactEmail: "treeves@curtisswright.com",
    contactPhone: "+1 (704) 869-4600",
    contactLinkedIn: "https://linkedin.com/in/thomas-reeves-aerospace",
    companyWebsite: "https://www.curtisswright.com",
    companyIndustry: "Aerospace & Defense",
    companySize: "8,500",
    companyDescription: "Defense electronics, naval systems, and industrial products. Produces flight data recorders, actuation systems, and nuclear power components.",
    source: "manual",
    status: "new",
    fitScore: 85,
    priority: "hot",
    painPoints: ["Pro/E (Creo) licenses costly — half team wants SOLIDWORKS", "CFD analysis outsourced to consultants at $30K/project", "No formal PDM — SharePoint used for CAD version control"],
  },
  {
    companyName: "UFP Technologies",
    contactName: "Lisa Hartmann",
    contactTitle: "VP of Product Development",
    contactEmail: "lhartmann@ufpt.com",
    contactPhone: "+1 (978) 352-2200",
    contactLinkedIn: "https://linkedin.com/in/lisa-hartmann-packaging",
    companyWebsite: "https://www.ufpt.com",
    companyIndustry: "Medical Devices",
    companySize: "1,600",
    companyDescription: "Custom packaging, components, and specialty products for medical device, aerospace, and automotive markets. Foam, fiber, and plastic composite parts.",
    source: "manual",
    status: "contacted",
    fitScore: 71,
    priority: "warm",
    painPoints: ["All design done in 2D AutoCAD — customer RFQs requiring 3D models", "No 3D printing in-house — outsourcing prototype foam mockups", "DFAM capabilities needed for complex internal geometries"],
  },
  {
    companyName: "Dynamic Manufacturing",
    contactName: "Brian Kowalski",
    contactTitle: "Engineering Manager",
    contactEmail: "bkowalski@dynamicmfg.com",
    contactPhone: "+1 (630) 543-9000",
    contactLinkedIn: "https://linkedin.com/in/brian-kowalski-mfg",
    companyWebsite: "https://www.dynamicmfg.com",
    companyIndustry: "Industrial Equipment",
    companySize: "400",
    companyDescription: "Metal stampings, assemblies, and value-added welding for automotive and industrial customers. Tier 2 supplier to the Midwest auto corridor.",
    source: "manual",
    status: "new",
    fitScore: 68,
    priority: "warm",
    painPoints: ["SOLIDWORKS seats licensed but no formal training — team uses <30% of features", "CNC programming done manually in G-code — no CAM software", "Tooling designs lost when senior engineer retired"],
  },
  {
    companyName: "IEC Electronics",
    contactName: "Deborah Walsh",
    contactTitle: "Director of Engineering",
    contactEmail: "dwalsh@iec-electronics.com",
    contactPhone: "+1 (315) 331-7742",
    contactLinkedIn: "https://linkedin.com/in/deborah-walsh-electronics",
    companyWebsite: "https://www.iec-electronics.com",
    companyIndustry: "Electronics Manufacturing",
    companySize: "700",
    companyDescription: "Contract electronics manufacturer serving medical, defense, and industrial markets. PCBs, box builds, and full PCBA to finished product.",
    source: "manual",
    status: "new",
    fitScore: 74,
    priority: "warm",
    painPoints: ["No thermal simulation for high-density PCB assemblies", "IPC-A-610 inspection documented in spreadsheets", "3D printing for fixture and tooling outsourced — 2 week lead times"],
  },
  {
    companyName: "Moog Inc.",
    contactName: "Steven Park",
    contactTitle: "CAE / Simulation Engineer",
    contactEmail: "spark@moog.com",
    contactPhone: "+1 (716) 652-2000",
    contactLinkedIn: "https://linkedin.com/in/steven-park-simulation",
    companyWebsite: "https://www.moog.com",
    companyIndustry: "Aerospace & Defense",
    companySize: "14,000",
    companyDescription: "Precision motion control products for aerospace, defense, medical, and industrial applications. Flight controls, satellite mechanisms, and surgical robotics.",
    source: "manual",
    status: "contacted",
    fitScore: 87,
    priority: "hot",
    painPoints: ["ANSYS Mechanical too expensive — 80% of engineers excluded from simulation", "SOLIDWORKS Simulation add-on seats purchased but never deployed", "FEA results not traceable to design revisions in PDM"],
  },
  {
    companyName: "Acuity Brands Lighting",
    contactName: "Rachel Tompkins",
    contactTitle: "Sr. Mechanical Design Engineer",
    contactEmail: "rtompkins@acuitybrands.com",
    contactPhone: "+1 (404) 853-1400",
    contactLinkedIn: "https://linkedin.com/in/rachel-tompkins-lighting",
    companyWebsite: "https://www.acuitybrands.com",
    companyIndustry: "Electronics Manufacturing",
    companySize: "12,000",
    companyDescription: "Lighting equipment and building management systems. Luminaires, controls, and IoT-connected building technology.",
    source: "manual",
    status: "new",
    fitScore: 72,
    priority: "warm",
    painPoints: ["Thermal management simulation needed for LED driver designs", "Design configuration variants managed manually — 400+ SKU nightmare", "DriveWorks or equivalent needed for custom luminaire quoting"],
  },
  {
    companyName: "Haynes Wire Company",
    contactName: "Mark Engel",
    contactTitle: "Manufacturing Engineering Lead",
    contactEmail: "mengel@hayneswire.com",
    contactPhone: "+1 (765) 456-6000",
    contactLinkedIn: "https://linkedin.com/in/mark-engel-manufacturing",
    companyWebsite: "https://www.haynes.com",
    companyIndustry: "Industrial Equipment",
    companySize: "1,400",
    companyDescription: "High-performance alloy wire and strip for aerospace, chemical processing, and industrial heat applications. Nickel and cobalt-based superalloys.",
    source: "manual",
    status: "new",
    fitScore: 66,
    priority: "warm",
    painPoints: ["Legacy AutoCAD 2D drawings — no 3D models for any tooling", "No scan-to-CAD for reverse engineering worn dies and tooling", "Material simulation needed for superalloy forming processes"],
  },
];

async function seedHRSLeads() {
  console.log("\n🦅 Hawk Ridge Systems — Demo Lead Seeder\n");

  // Get first SDR to assign leads to
  const allSdrs = await db.select().from(sdrs).limit(5);
  if (allSdrs.length === 0) {
    console.error("❌ No SDRs found. Run the main seed script first.");
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const [i, lead] of HRS_LEADS.entries()) {
    const sdr = allSdrs[i % allSdrs.length];

    // Check for duplicate by email
    const existing = await db.select().from(leads)
      .where(eq(leads.contactEmail, lead.contactEmail))
      .limit(1);

    if (existing.length > 0) {
      console.log(`   ⏭  Skipping ${lead.companyName} (already exists)`);
      skipped++;
      continue;
    }

    const [created] = await db.insert(leads).values({
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactTitle: lead.contactTitle,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      contactLinkedIn: lead.contactLinkedIn,
      companyWebsite: lead.companyWebsite,
      companyIndustry: lead.companyIndustry,
      companySize: lead.companySize,
      companyDescription: lead.companyDescription,
      source: lead.source,
      status: lead.status as any,
      fitScore: lead.fitScore,
      priority: lead.priority,
      assignedSdrId: sdr.id,
      qualificationNotes: `Pain points: ${lead.painPoints.join('; ')}`,
    }).returning();

    console.log(`   ✅ ${lead.companyName} — ${lead.contactName} (${lead.fitScore} ${lead.priority})`);
    inserted++;
  }

  console.log(`\n✅ Done: ${inserted} leads inserted, ${skipped} skipped.\n`);
  process.exit(0);
}

seedHRSLeads().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
