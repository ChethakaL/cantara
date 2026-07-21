"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, MapPin, CheckCircle2, Circle, ClipboardCheck } from "lucide-react";

export default function RoadmapAnimationPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Step 0: Initial State
    // Step 1: Generating... (Loading Card)
    // Step 2: Show Table and Checklist (Complete)

    const timer1 = setTimeout(() => setStep(1), 1000);
    const timer2 = setTimeout(() => setStep(2), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleReplay = () => {
    setStep(0);
    setTimeout(() => setStep(1), 500);
    setTimeout(() => setStep(2), 4500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Mac Window Mockup */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-5xl h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] overflow-hidden border border-slate-200 relative"
      >
        {/* Mac Title Bar */}
        <div className="h-10 bg-slate-50 flex items-center px-4 border-b border-slate-200 relative">
          <div className="flex space-x-2 absolute left-4">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50"></div>
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50"></div>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-semibold text-slate-500 tracking-wide select-none">
              Cantara Advisors - Readiness Portal
            </span>
          </div>
        </div>

        {/* Window Content */}
        <div className="p-8 md:p-12 flex-1 bg-white relative overflow-y-auto">
          
          {/* Header (Always present) */}
          <div className="space-y-5 mb-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Sales Readiness Roadmap</h2>
                <p className="text-xs text-slate-500 mt-1">WS1 — Risk Mitigation — Seller-Facing Sale Readiness Plan</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={handleReplay} 
                  disabled={step === 1}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white shadow-sm hover:bg-slate-100 text-slate-900 h-8 px-3"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${step === 1 ? 'animate-spin' : ''}`} />
                  {step === 2 ? 'Regenerate' : 'Generate Roadmap'}
                </button>
                {step === 2 && (
                  <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none border border-slate-200 bg-white shadow-sm hover:bg-slate-100 text-slate-900 h-8 px-3">
                    Export PDF
                  </button>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
               <motion.div
                 key="step0"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="rounded-xl border border-slate-200 bg-white shadow-sm p-10 text-center"
               >
                 <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                   <MapPin className="w-7 h-7 text-emerald-500" />
                 </div>
                 <h3 className="text-lg font-semibold text-slate-800 mb-2">Sales Readiness Roadmap</h3>
                 <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                   Generate a seller-facing assessment and improvement roadmap based on all risk mitigation agent findings. Shows the seller exactly what to do to become sale-ready.
                 </p>
               </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="rounded-xl border border-slate-200 bg-white shadow-sm p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">Building Sales Readiness Roadmap</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Analyzing all agent findings to create a prioritized, actionable improvement plan with sale readiness indicators. This takes 30-60 seconds.
                    </p>
                    <div className="mt-5 space-y-3">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "66%" }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-3 rounded bg-slate-100" 
                      />
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, delay: 0.2, ease: "easeOut" }}
                        className="h-3 rounded bg-slate-100" 
                      />
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "83%" }}
                        transition={{ duration: 1.8, delay: 0.4, ease: "easeOut" }}
                        className="h-3 rounded bg-slate-100" 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6 pb-10"
              >
                {/* Checklist Approval Panel */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Client Checklist Release</p>
                        <p className="text-[11px] text-slate-500">Approve rows Craig wants visible in the client portal checklist.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                        Approve All
                      </button>
                      <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        2/3 approved
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Visible</th>
                          <th className="px-4 py-2 text-left font-semibold">Category</th>
                          <th className="px-4 py-2 text-left font-semibold">Item</th>
                          <th className="px-4 py-2 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Row 1 */}
                        <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="align-top">
                          <td className="px-4 py-3">
                            <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors border-slate-200 bg-white text-slate-500">
                              <Circle className="h-3.5 w-3.5" /> Approve
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">Financials</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">Audited Financial Statements</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Engage a CPA firm to conduct a full audit.</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">🔴 Red</span>
                          </td>
                        </motion.tr>
                        {/* Row 2 */}
                        <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="align-top">
                          <td className="px-4 py-3">
                            <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors border-emerald-200 bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">Operations</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">Key Supplier Contracts</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Renew the top 3 supplier contracts extending beyond 2027.</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">🟡 Yellow</span>
                          </td>
                        </motion.tr>
                        {/* Row 3 */}
                        <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="align-top">
                          <td className="px-4 py-3">
                            <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors border-emerald-200 bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">Legal</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">Intellectual Property</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Trademarks registered in all operating regions.</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">🟢 Green</span>
                          </td>
                        </motion.tr>
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Markdown Report Mockup */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="pt-4"
                >
                  <h1 className="mb-5 border-b-2 border-emerald-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">
                    Sales Readiness Roadmap - Acme Corp
                  </h1>
                  
                  <p className="mb-4 text-sm leading-7 text-slate-700">
                    This document outlines the critical steps required to prepare the business for an optimal sale process. Addressing these items will maximize valuation and minimize buyer friction during due diligence.
                  </p>

                  <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">
                    Executive Summary
                  </h2>
                  <p className="mb-4 text-sm leading-7 text-slate-700">
                    Overall readiness is currently assessed at <strong className="font-bold text-slate-900">65%</strong>. Key vulnerabilities lie in financial reporting and customer concentration. We recommend prioritizing the Financials track immediately.
                  </p>

                  <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">
                    Key Action Areas
                  </h2>
                  <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">
                    <li className="leading-7">Initiate Quality of Earnings (QoE) report to validate historical EBITDA.</li>
                    <li className="leading-7">Migrate legacy HR systems to a cloud-based platform for scalable operations.</li>
                    <li className="leading-7">Resolve outstanding litigation with Supplier B to eliminate contingent liabilities.</li>
                  </ul>
                  
                  <hr className="my-8 border-slate-200" />
                  
                  <div className="text-center text-xs text-slate-400 pb-4">
                    Generated automatically by Cantara Advisors Agent System
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
