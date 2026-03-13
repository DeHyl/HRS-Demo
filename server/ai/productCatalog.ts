// Hawk Ridge Systems — Product & Service Catalog
// Source: hawkridgesys.com (scraped March 2026)
// "Better Engineering Starts Here" — empowering engineers since 1996
// 23,000+ customers | 22+ offices across US & Canada

export interface HawkRidgeProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  idealFor: string[];
  painPointsSolved: string[];
  industries: string[];
  companySizeMatch: string[];
  keywords: string[];
  vendor: string;
  competesAgainst: string[];
}

export const HAWK_RIDGE_PRODUCTS: HawkRidgeProduct[] = [
  // ─── SOLIDWORKS CAD ───────────────────────────────────────────────────────
  {
    id: "solidworks-professional",
    name: "SOLIDWORKS Professional",
    category: "CAD Software",
    vendor: "Dassault Systèmes",
    description: "3D parametric solid modeling with component library (Toolbox), photo rendering (Visualize Standard), costing application, and eDrawings Pro. Best fit for most design engineers.",
    idealFor: ["Design engineers doing part & assembly modeling", "Teams moving from 2D CAD (AutoCAD, DraftSight)", "Companies standardizing on a single CAD platform"],
    painPointsSolved: ["Still using 2D AutoCAD for 3D design", "Multiple disconnected CAD tools", "Slow design iteration cycles", "No integrated component library"],
    industries: ["Industrial Equipment", "Consumer Products", "Electronics", "Medical Devices", "Automotive"],
    companySizeMatch: ["5-50", "51-200", "201-500"],
    keywords: ["solidworks", "CAD", "3D modeling", "parametric", "design", "parts", "assemblies", "drawings"],
    competesAgainst: ["Autodesk Inventor", "PTC Creo", "Siemens NX", "Fusion 360", "Onshape"],
  },
  {
    id: "solidworks-premium",
    name: "SOLIDWORKS Premium",
    category: "CAD Software",
    vendor: "Dassault Systèmes",
    description: "All Professional features plus built-in Simulation (static FEA), Motion analysis, Routing (piping/electrical), and TolAnalyst. Ideal for power users who need stress testing without buying separate simulation.",
    idealFor: ["Mechanical engineers needing built-in FEA", "Teams designing piping or electrical routing", "Power users wanting all-in-one design + analysis"],
    painPointsSolved: ["Separate CAD and FEA tools that don't integrate", "No way to validate designs before prototyping", "Expensive physical prototypes from design errors"],
    industries: ["Aerospace & Defense", "Industrial Equipment", "Medical Devices", "Automotive", "Electronics"],
    companySizeMatch: ["10-50", "51-200", "201-500", "500+"],
    keywords: ["solidworks premium", "FEA", "simulation", "stress analysis", "motion", "routing", "piping"],
    competesAgainst: ["Autodesk Inventor + Nastran", "PTC Creo + Simulate", "Siemens NX CAE"],
  },
  {
    id: "solidworks-simulation-professional",
    name: "SOLIDWORKS Simulation Professional",
    category: "Simulation / FEA",
    vendor: "Dassault Systèmes",
    description: "Finite element analysis (FEA) for structural, thermal, frequency, buckling, fatigue, drop-test, and optimization studies directly inside SOLIDWORKS. No data translation required.",
    idealFor: ["Engineers validating structural integrity", "Teams reducing physical prototype costs", "Companies with regulatory compliance requirements (FDA, AS9100)"],
    painPointsSolved: ["Physical prototypes failing late in development", "Expensive and slow third-party FEA consultants", "Design changes after tooling already cut", "No data on material stress limits"],
    industries: ["Aerospace & Defense", "Medical Devices", "Automotive", "Industrial Equipment"],
    companySizeMatch: ["10-50", "51-200", "201-500", "500+"],
    keywords: ["simulation", "FEA", "finite element", "stress analysis", "thermal", "fatigue", "structural", "ANSYS", "analysis"],
    competesAgainst: ["ANSYS Mechanical", "Abaqus", "Nastran", "PTC Creo Simulate"],
  },
  {
    id: "solidworks-flow-simulation",
    name: "SOLIDWORKS Flow Simulation",
    category: "Simulation / CFD",
    vendor: "Dassault Systèmes",
    description: "Computational fluid dynamics (CFD) for internal/external flow, heat transfer, and pressure drop analysis — air, liquids, and gases — built directly into SOLIDWORKS.",
    idealFor: ["Engineers designing HVAC, pumps, or valves", "Electronics cooling analysis", "Thermal management in enclosures"],
    painPointsSolved: ["Unknown flow behavior without physical testing", "Electronics overheating issues found late", "Manual thermal calculations that miss key effects"],
    industries: ["Electronics", "Industrial Equipment", "Aerospace & Defense", "Medical Devices"],
    companySizeMatch: ["10-50", "51-200", "201-500"],
    keywords: ["CFD", "fluid dynamics", "flow simulation", "thermal", "heat transfer", "HVAC", "cooling", "pressure drop"],
    competesAgainst: ["ANSYS Fluent", "Autodesk CFD", "Star-CCM+"],
  },
  {
    id: "solidworks-pdm-professional",
    name: "SOLIDWORKS PDM Professional",
    category: "PDM / Data Management",
    vendor: "Dassault Systèmes",
    description: "Enterprise product data management — version control, check-in/check-out, workflow automation, role-based permissions, BOM management, and audit trails. Supports SOLIDWORKS, AutoCAD, Inventor, and Office files.",
    idealFor: ["Teams losing files or working on wrong versions", "Companies with engineering change order chaos", "Organizations needing traceability for ISO/AS9100 audits"],
    painPointsSolved: ["Files saved on shared drives with no version control", "Engineers overwriting each other's work", "No audit trail for engineering changes", "BOM management done in spreadsheets", "Failed ISO/AS9100 audits due to document control"],
    industries: ["Aerospace & Defense", "Medical Devices", "Automotive", "Industrial Equipment", "Electronics"],
    companySizeMatch: ["10-50", "51-200", "201-500", "500+"],
    keywords: ["PDM", "PLM", "version control", "data management", "vault", "revision control", "BOM", "engineering change", "ECO", "workflow"],
    competesAgainst: ["PTC Windchill", "Siemens Teamcenter", "Autodesk Vault", "Arena PLM", "Agile PLM"],
  },
  {
    id: "solidworks-manage",
    name: "SOLIDWORKS Manage",
    category: "PLM",
    vendor: "Dassault Systèmes",
    description: "Full PLM layer on top of PDM Professional — project management, advanced BOM, engineering change management, process automation, and business analytics for complete product lifecycle governance.",
    idealFor: ["Companies needing full PLM without SAP/Oracle complexity", "Engineering orgs managing multiple concurrent product programs", "Companies with complex multi-level BOM management needs"],
    painPointsSolved: ["PDM exists but project management is in spreadsheets", "No visibility across multiple concurrent programs", "Engineering and manufacturing BOMs out of sync"],
    industries: ["Aerospace & Defense", "Automotive", "Medical Devices", "Industrial Equipment"],
    companySizeMatch: ["51-200", "201-500", "500+"],
    keywords: ["PLM", "product lifecycle", "project management", "change management", "BOM management", "program management"],
    competesAgainst: ["PTC Windchill", "Siemens Teamcenter", "Dassault ENOVIA", "Arena PLM"],
  },
  {
    id: "3dexperience-cloud",
    name: "3DEXPERIENCE Cloud Platform",
    category: "Cloud CAD / PLM",
    vendor: "Dassault Systèmes",
    description: "Browser-based CAD (xDesign), cloud PDM, advanced simulation (SIMULIA), and PLM — same Dassault Systèmes technology stack as desktop SOLIDWORKS, accessible from any device without installation.",
    idealFor: ["Distributed or remote engineering teams", "Companies wanting zero-IT-infrastructure overhead", "Organizations evaluating SaaS alternatives to desktop CAD"],
    painPointsSolved: ["Remote teams can't collaborate on CAD files", "IT overhead of managing CAD workstations and licenses", "No real-time multi-user CAD collaboration"],
    industries: ["All Manufacturing Industries"],
    companySizeMatch: ["5-50", "51-200", "201-500", "500+"],
    keywords: ["cloud CAD", "xDesign", "3DEXPERIENCE", "SaaS CAD", "cloud PLM", "browser CAD", "remote collaboration"],
    competesAgainst: ["Autodesk Fusion 360", "Onshape", "PTC Creo+", "Siemens NX Cloud"],
  },
  // ─── CAM & MANUFACTURING ────────────────────────────────────────────────────
  {
    id: "camworks",
    name: "CAMWorks",
    category: "CAM / CNC Programming",
    vendor: "HCL Technologies",
    description: "Full-featured CAM and CNC programming fully integrated inside SOLIDWORKS. Feature Recognition (AFR) and Knowledge-Based Machining (KBM) automate toolpath generation. Supports 2.5-axis through full 5-axis milling, mill-turn, and sub-spindle turning.",
    idealFor: ["Shops using SOLIDWORKS for design and CNC for manufacturing", "Companies reducing manual programming time", "Machine shops with complex 5-axis or multi-spindle work"],
    painPointsSolved: ["Manual CNC programming taking hours per part", "Re-programming needed every time design changes", "Disconnected CAD and CAM tools requiring data translation", "Programming errors causing scrap and rework"],
    industries: ["Aerospace & Defense", "Medical Devices", "Automotive", "Industrial Equipment", "Contract Manufacturing"],
    companySizeMatch: ["5-50", "51-200", "201-500"],
    keywords: ["CAM", "CNC", "machining", "toolpath", "G-code", "milling", "turning", "5-axis", "manufacturing", "Mastercam", "Fusion CAM"],
    competesAgainst: ["Mastercam", "Autodesk Fusion 360 CAM", "Siemens NX CAM", "GibbsCAM", "hyperMILL"],
  },
  {
    id: "driveworks-pro",
    name: "DriveWorks Pro",
    category: "Design Automation / CPQ",
    vendor: "DriveWorks Ltd",
    description: "Enterprise SOLIDWORKS design automation and online 3D CPQ (Configure-Price-Quote) platform. Automatically generates custom quotes, sales drawings, and production-ready SOLIDWORKS models from customer inputs — no manual engineering per order.",
    idealFor: ["Manufacturers with configurable or custom products", "Engineers spending 80% of time on repetitive order-driven designs", "Sales teams quoting custom products without engineering involvement"],
    painPointsSolved: ["Every customer order requires custom engineering time", "Quotes take days because engineering must redraw each variant", "Sales can't quote custom products without engineering help", "Order errors from manual CAD reconfiguration"],
    industries: ["Industrial Equipment", "Consumer Products", "Architectural Products", "Furniture", "Automation"],
    companySizeMatch: ["10-50", "51-200", "201-500", "500+"],
    keywords: ["design automation", "CPQ", "configure price quote", "configurator", "rules-based design", "DriveWorks", "product configurator", "variant design"],
    competesAgainst: ["Salesforce CPQ", "Tacton", "KBMax (Epicor CPQ)", "Tacton CPQ"],
  },
  // ─── 3D PRINTING ────────────────────────────────────────────────────────────
  {
    id: "markforged-composite",
    name: "Markforged Composite Printers (Onyx / Mark Two / X-Series)",
    category: "3D Printing — Composite FFF",
    vendor: "Markforged",
    description: "Continuous carbon fiber, fiberglass, and Kevlar reinforced FFF printing. Produces parts with metal-like strength from a desktop or industrial printer. Desktop (Onyx, Mark Two) through industrial (X3, X7, FX10, FX20) systems.",
    idealFor: ["Engineers replacing aluminum fixtures and tooling with printed parts", "Aerospace and defense teams needing lightweight high-strength parts", "Medical device companies needing biocompatible or sterilizable parts"],
    painPointsSolved: ["Outsourcing jigs and fixtures takes weeks and is expensive", "Metal machined tooling too heavy for ergonomic use", "Prototype lead times bottlenecking product development"],
    industries: ["Aerospace & Defense", "Automotive", "Medical Devices", "Industrial Equipment"],
    companySizeMatch: ["5-50", "51-200", "201-500", "500+"],
    keywords: ["3D printing", "carbon fiber", "composite", "additive manufacturing", "fixtures", "jigs", "tooling", "Markforged", "continuous fiber", "FFF"],
    competesAgainst: ["Stratasys FDM", "Ultimaker", "Formlabs FDM", "Desktop Metal"],
  },
  {
    id: "markforged-metal-x",
    name: "Markforged Metal X",
    category: "3D Printing — Metal",
    vendor: "Markforged",
    description: "Metal FFF (ADAM process) — bound metal filament in 17-4 PH stainless steel, H13, A2/D2 tool steels, Inconel, and copper. Safer than powder-bed metal (no loose powder). Sinter in Metal X wash and sinter station.",
    idealFor: ["Machine shops printing metal prototypes and end-use parts in-house", "Engineers replacing machined metal components with printed alternatives", "Teams needing small batch metal parts without EDM or machining lead time"],
    painPointsSolved: ["Metal prototype lead times of 4–8 weeks from outside vendors", "CNC machining capacity constraints", "High cost per metal part for low-volume production runs"],
    industries: ["Aerospace & Defense", "Medical Devices", "Automotive", "Industrial Equipment", "Tooling"],
    companySizeMatch: ["10-50", "51-200", "201-500"],
    keywords: ["metal 3D printing", "metal additive", "stainless steel", "tool steel", "Inconel", "metal parts", "ADAM", "bound metal"],
    competesAgainst: ["EOS", "Desktop Metal Studio", "Trumpf TruPrint", "GE Additive"],
  },
  {
    id: "hp-jet-fusion",
    name: "HP Jet Fusion 5000/5200/5600 Series",
    category: "3D Printing — MJF Polymer",
    vendor: "HP",
    description: "Multi Jet Fusion (MJF) industrial polymer printing in PA 12 and PA 11 nylon. Production-grade throughput — 200+ parts per build cycle. Isotropic mechanical properties, no support structures needed.",
    idealFor: ["Companies producing end-use nylon parts at volume", "Manufacturers replacing injection molding for short runs", "Teams printing functional assemblies in a single build"],
    painPointsSolved: ["Injection molding tooling cost prohibitive for low-volume parts", "Support structure removal adding post-processing time", "Anisotropic SLS parts failing in certain load directions"],
    industries: ["Automotive", "Consumer Products", "Medical Devices", "Industrial Equipment", "Aerospace & Defense"],
    companySizeMatch: ["51-200", "201-500", "500+"],
    keywords: ["MJF", "HP Jet Fusion", "nylon", "PA12", "production 3D printing", "powder bed", "additive manufacturing", "SLS alternative"],
    competesAgainst: ["EOS SLS", "3D Systems SLS", "Stratasys H350"],
  },
  {
    id: "formlabs-form4",
    name: "Formlabs Form 4 / Form 4L (SLA)",
    category: "3D Printing — Resin SLA",
    vendor: "Formlabs",
    description: "Low Force Stereolithography (LFS) — fast, reliable, high-accuracy resin printing. Extensive engineering materials library: standard, tough, rigid, flexible, high-temp, dental, castable. Form 4L provides large-format capability.",
    idealFor: ["Design engineers needing high-detail prototypes fast", "Medical and dental teams printing patient-specific devices", "Teams testing form, fit, and function before tooling"],
    painPointsSolved: ["FDM layer lines and poor surface finish failing aesthetic reviews", "Long prototype lead times from outside service bureaus", "Limited material options on FDM printers for functional testing"],
    industries: ["Medical Devices", "Consumer Products", "Aerospace & Defense", "Electronics", "Dental"],
    companySizeMatch: ["5-50", "51-200", "201-500"],
    keywords: ["SLA", "resin printing", "stereolithography", "Formlabs", "Form 4", "high detail", "smooth surface", "dental", "castable"],
    competesAgainst: ["3D Systems SLA", "Carbon DLS", "EnvisionTEC", "Stratasys PolyJet"],
  },
  // ─── 3D SCANNING ────────────────────────────────────────────────────────────
  {
    id: "artec-handheld-scanners",
    name: "Artec 3D Scanners (Leo / EVA / Spider II)",
    category: "3D Scanning",
    vendor: "Artec 3D",
    description: "Professional handheld structured-light 3D scanners for reverse engineering, inspection, and digital archiving. Leo is wireless with onboard display; EVA for large objects; Spider II for high-accuracy small/complex parts.",
    idealFor: ["Engineers capturing as-built geometry for reverse engineering", "Quality teams verifying parts against CAD nominal", "Companies digitizing legacy parts with no existing CAD"],
    painPointsSolved: ["Legacy parts with no CAD data can't be redesigned or replaced", "Manual measurement of complex freeform surfaces is inaccurate", "Expensive and slow CMM programming for first article inspection"],
    industries: ["Aerospace & Defense", "Automotive", "Medical Devices", "Industrial Equipment", "Cultural Heritage"],
    companySizeMatch: ["5-50", "51-200", "201-500", "500+"],
    keywords: ["3D scanning", "reverse engineering", "handheld scanner", "structured light", "Artec", "scan-to-CAD", "inspection", "metrology"],
    competesAgainst: ["Creaform", "FARO", "Hexagon handheld", "Zeiss T-SCAN"],
  },
  {
    id: "geomagic-design-x",
    name: "Geomagic Design X (Scan-to-CAD)",
    category: "3D Scanning Software",
    vendor: "Hexagon / 3D Systems",
    description: "Complete scan-to-CAD reverse engineering software — mesh editing, automated feature extraction, parametric solid modeling, and direct SOLIDWORKS integration. Creates fully-featured CAD models from scan data.",
    idealFor: ["Engineers reverse engineering legacy parts or competitor products", "Teams creating CAD from physical objects with no drawings", "Companies digitizing tooling masters, molds, or patterns"],
    painPointsSolved: ["Scan data is a mesh — can't be edited or used in SOLIDWORKS directly", "Manual recreation of parts from physical measurements is slow and inaccurate", "Molds and tooling worn but no CAD exists to regrind or repair"],
    industries: ["Aerospace & Defense", "Automotive", "Industrial Equipment", "Medical Devices"],
    companySizeMatch: ["5-50", "51-200", "201-500"],
    keywords: ["Geomagic", "Design X", "scan to CAD", "reverse engineering", "mesh to solid", "point cloud", "NURBS", "parametric"],
    competesAgainst: ["Siemens NX Reverse Engineering", "Autodesk ReCap", "PolyWorks Modeler"],
  },
  {
    id: "geomagic-control-x",
    name: "Geomagic Control X (Dimensional Inspection)",
    category: "Metrology / Inspection Software",
    vendor: "Hexagon / 3D Systems",
    description: "Dimensional inspection software — compare 3D scan data to CAD nominal, full GD&T analysis, color deviation maps, first article inspection (FAI) reports, and automated reporting for AS9100 / ISO 9001 compliance.",
    idealFor: ["Quality engineers doing first article inspection (FAI)", "Teams with AS9100 or ISO 9001 compliance requirements", "Manufacturers catching tooling drift and out-of-tolerance parts"],
    painPointsSolved: ["First article inspection taking days with CMM programming", "Out-of-tolerance parts discovered after full production run", "Manual inspection missing complex freeform surface deviations"],
    industries: ["Aerospace & Defense", "Automotive", "Medical Devices", "Industrial Equipment"],
    companySizeMatch: ["10-50", "51-200", "201-500", "500+"],
    keywords: ["inspection", "metrology", "GD&T", "FAI", "first article", "Control X", "dimensional inspection", "color map", "deviation analysis", "CMM"],
    competesAgainst: ["PolyWorks Inspector", "Zeiss Calypso", "Hexagon PC-DMIS", "Verisurf"],
  },
  // ─── TRAINING & SERVICES ─────────────────────────────────────────────────────
  {
    id: "solidworks-training",
    name: "SOLIDWORKS Training & Certification",
    category: "Training",
    vendor: "Hawk Ridge Systems",
    description: "Instructor-led SOLIDWORKS training at 22+ North American centers, live virtual, or self-paced (SolidProfessor). Courses from Essentials through Advanced Surfacing, Simulation, Weldments, Sheet Metal, PDM, Electrical, and MBD. CSWA/CSWP/CSWE certification testing center.",
    idealFor: ["New SOLIDWORKS users coming from AutoCAD or other CAD", "Engineers wanting to pass CSWA/CSWP certification", "Teams standardizing workflows and best practices"],
    painPointsSolved: ["Low SOLIDWORKS adoption after license purchase", "Reps using <20% of software capabilities", "Failed certification exams", "Tribal knowledge instead of documented standard practices"],
    industries: ["All Manufacturing Industries"],
    companySizeMatch: ["1-10", "10-50", "51-200", "201-500", "500+"],
    keywords: ["training", "SOLIDWORKS training", "CSWA", "CSWP", "CSWE", "certification", "SolidProfessor", "instructor-led", "online training"],
    competesAgainst: ["Dassault Systèmes direct training", "SolidProfessor standalone", "LinkedIn Learning", "Udemy"],
  },
  {
    id: "implementation-services",
    name: "Implementation & Engineering Services",
    category: "Professional Services",
    vendor: "Hawk Ridge Systems",
    description: "Full deployment and configuration for SOLIDWORKS, PDM/PLM, CAMWorks, DriveWorks — scoping, installation, data migration, and onboarding. Plus contracted design & engineering: CAD, FEA/CFD/EM simulation, reverse engineering, DFAM, PCB design, and 3D scanning services.",
    idealFor: ["Companies buying software and needing expert deployment", "Teams with engineering projects beyond internal capacity", "Organizations needing outsourced simulation or scanning work"],
    painPointsSolved: ["Software bought but never fully deployed or adopted", "Internal team lacks bandwidth for a simulation project", "One-time scanning or reverse engineering need without scanner investment"],
    industries: ["All Manufacturing Industries"],
    companySizeMatch: ["5-50", "51-200", "201-500", "500+"],
    keywords: ["implementation", "consulting", "professional services", "engineering services", "deployment", "migration", "scanning services", "simulation services"],
    competesAgainst: ["Other SolidWorks VARs", "Accenture/Deloitte PLM practices", "Independent CAD consultants"],
  },
];

// ─── Product Matching ────────────────────────────────────────────────────────

export function matchProductsToLead(
  industry: string | null,
  companySize: string | null,
  painPoints: string[],
  techStack: string[]
): Array<{ product: HawkRidgeProduct; score: number; rationale: string }> {
  const matches: Array<{ product: HawkRidgeProduct; score: number; rationale: string }> = [];

  for (const product of HAWK_RIDGE_PRODUCTS) {
    let score = 0;
    const reasons: string[] = [];

    // Industry alignment (25 points)
    if (industry && product.industries.some(i =>
      i.toLowerCase().includes(industry.toLowerCase()) ||
      industry.toLowerCase().includes(i.toLowerCase()) ||
      i === "All Manufacturing Industries"
    )) {
      score += 25;
      reasons.push(`Industry match: ${industry}`);
    }

    // Company size fit (20 points)
    if (companySize) {
      const sizeNum = parseInt(companySize.replace(/[^0-9]/g, ''));
      if (!isNaN(sizeNum) && product.companySizeMatch.some(range => {
        if (range === "500+") return sizeNum >= 500;
        const [min, max] = range.split("-").map(Number);
        return sizeNum >= min && sizeNum <= max;
      })) {
        score += 20;
        reasons.push(`Company size fit`);
      }
    }

    // Pain point matching (35 points max)
    const painText = [...painPoints, ...techStack].join(" ").toLowerCase();
    const matchedPains = product.painPointsSolved.filter(p =>
      painText.includes(p.toLowerCase().split(" ").slice(0, 3).join(" "))
    );
    const matchedKeywords = product.keywords.filter(k => painText.includes(k.toLowerCase()));

    if (matchedPains.length > 0 || matchedKeywords.length > 0) {
      score += Math.min((matchedPains.length * 12) + (matchedKeywords.length * 5), 35);
      if (matchedPains.length > 0) reasons.push(`Addresses: ${matchedPains.slice(0, 2).join("; ")}`);
    }

    // Competitor displacement signal (20 points)
    const competitorHit = product.competesAgainst.find(c =>
      painText.includes(c.toLowerCase().split(" ")[0])
    );
    if (competitorHit) {
      score += 20;
      reasons.push(`Displacement opportunity vs. ${competitorHit}`);
    }

    if (score >= 25) {
      matches.push({
        product,
        score: Math.min(score, 100),
        rationale: reasons.join(". "),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── Prompt for AI Agents ────────────────────────────────────────────────────

export function getProductCatalogPrompt(): string {
  return `HAWK RIDGE SYSTEMS — PRODUCT CATALOG (North America's #1 SOLIDWORKS Reseller)

"Better Engineering Starts Here" — 23,000+ customers, 22+ offices, US & Canada.
Core vendor partners: Dassault Systèmes, HCL CAMWorks, Markforged, HP, Formlabs, Stratasys, Artec 3D, SCANTECH, Hexagon/Geomagic, DriveWorks.

TARGET INDUSTRIES: Aerospace & Defense, Medical Devices, Automotive, Industrial Equipment, Electronics, Consumer Products

IDEAL CUSTOMER PROFILE:
- Engineering teams of 5–500 using or evaluating CAD/CAM/Simulation/PDM tools
- Companies on legacy CAD (AutoCAD 2D, Inventor, Pro/E, NX, Creo) ready to standardize
- Manufacturers with PDM/PLM pain (files on shared drives, version chaos, no audit trail)
- Companies investing in 3D printing or scanning capabilities
- Teams failing design reviews due to no virtual validation (FEA/CFD)

KEY DISQUALIFIERS: Pure software companies, retail, restaurants, real estate, services firms without physical product development.

PRODUCT LINES:

${HAWK_RIDGE_PRODUCTS.map(p => `
**${p.name}** [${p.category} | ${p.vendor}]
- ${p.description}
- Ideal for: ${p.idealFor.slice(0, 2).join("; ")}
- Solves: ${p.painPointsSolved.slice(0, 3).join("; ")}
- Competes vs: ${p.competesAgainst.slice(0, 3).join(", ")}
`).join("\n")}

COMPETITIVE POSITIONING:
- vs. Autodesk (Inventor/Fusion/Vault): SOLIDWORKS has deeper manufacturing ecosystem, better CAM integration via CAMWorks, superior PDM for discrete manufacturing
- vs. PTC Creo/Windchill: SOLIDWORKS is faster to learn, lower TCO, better mid-market fit; Creo wins only at very large aerospace orgs
- vs. Siemens NX/Teamcenter: NX is complex/expensive enterprise-only; SOLIDWORKS accessible to 5-person shops through 500-person divisions
- vs. Onshape: SOLIDWORKS has far broader simulation, CAM, and PDM ecosystem; Onshape wins only on pure cloud/remote argument
- vs. In-house 3D printing alternatives: HRS provides machine + software + training + service + materials as a complete solution, not just hardware

HRS VALUE PROPOSITION:
1. Single vendor for entire design-to-manufacturing stack (CAD → Simulation → PDM → CAM → 3D Printing → Scanning)
2. Largest North American SOLIDWORKS reseller — 25+ years, local offices everywhere
3. Certified experts for every product line — not just software sales
4. Ongoing support, training, and professional services after the sale
`;
}

// ─── Backward compatibility ──────────────────────────────────────────────────
// matchServicesToLead alias used by older references
export const matchServicesToLead = (
  industry: string | null,
  companySize: string | null,
  painPoints: string[],
  techStack: string[]
) => matchProductsToLead(industry, companySize, painPoints, techStack)
  .map(r => ({ service: r.product, score: r.score, rationale: r.rationale }));

export const getServiceCatalogPrompt = getProductCatalogPrompt;
