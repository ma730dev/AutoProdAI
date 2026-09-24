'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PLANS_CONFIG, PlanConfig } from '@/lib/pricing-config';

interface SubscriptionPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanName?: string;
  currentCredits?: number | null;
  userEmail?: string;
  lang?: 'es' | 'en';
}

export default function SubscriptionPlansModal({
  isOpen,
  onClose,
  currentPlanName = 'FREE',
  currentCredits = null,
  userEmail = '',
  lang = 'es',
}: SubscriptionPlansModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [showNequiModal, setShowNequiModal] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async (planKey: 'STARTER' | 'PRO' | 'ENTERPRISE') => {
    setIsLoadingCheckout(true);
    const toastId = toast.loading(lang === 'es' ? 'Generando pasarela de pago seguro...' : 'Opening secure checkout...');
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: planKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar con la pasarela');
      }

      if (data.url) {
        toast.success(lang === 'es' ? 'Redirigiendo a Lemon Squeezy...' : 'Redirecting to checkout...', { id: toastId });
        window.location.href = data.url;
      } else if (data.manualPayment) {
        toast.info(lang === 'es' ? 'Pasarela directa no configurada. Abriendo método Nequi / Manual.' : 'Direct gateway not set. Opening Nequi transfer.', { id: toastId });
        setSelectedPlan(planKey);
        setShowNequiModal(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo iniciar el proceso de pago', { id: toastId });
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const getWhatsAppMessage = (planKey: 'STARTER' | 'PRO' | 'ENTERPRISE') => {
    const plan = PLANS_CONFIG[planKey];
    const text = encodeURIComponent(
      `¡Hola equipo AutoProd! Deseo suscribirme al *${plan.displayName}* ($${plan.priceUsd} USD) pagando mediante Nequi / Transferencia. Mi correo de cuenta es: ${userEmail || 'mi_correo@ejemplo.com'}. ¿Me confirman los datos de envío por favor?`
    );
    return `https://wa.me/573000000000?text=${text}`;
  };

  const allPlans: ('FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE')[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0e0e12] border border-zinc-800 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">

        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-purple-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 right-10 w-80 h-40 bg-indigo-600/15 blur-[90px] pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#121217]/50 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {lang === 'es' ? 'Planes de Producción y Bolsa de Tokens' : 'Production Plans & Token Wallet'}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                AutoProd Scale
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {lang === 'es'
                ? 'AutoProd Brain™ (Cerebro Autónomo 24/7) es 100% GRATIS e ILIMITADO en planes de pago. Tu bolsa mensual de tokens se reserva para renderizado, Whisper y modelos pesados.'
                : 'AutoProd Brain™ (24/7 Autonomous AI) is 100% FREE and UNLIMITED on paid plans. Your monthly allowance turns into credits for Whisper, video, and heavy models.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentCredits !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold">
                <span>🪙 Saldo actual:</span>
                <span className="font-bold">{currentCredits.toLocaleString()} créditos</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors text-sm cursor-pointer"
              title={lang === 'es' ? 'Cerrar' : 'Close'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Content - 4 Plan Cards */}
        <div className="p-4 sm:p-6 overflow-y-auto minimal-scrollbar relative z-10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allPlans.map((key) => {
              const plan = PLANS_CONFIG[key];
              const isCurrent = (currentPlanName || 'FREE').toUpperCase() === key;
              const isPopular = key === 'PRO';
              const isFree = key === 'FREE';

              // Net credits calculation
              const feePercent = 10;
              const netTokens = isFree ? 0.5 : plan.tokenBudgetUsd * (1 - feePercent / 100);
              const credits = isFree ? 50 : Math.round(netTokens * 100);

              return (
                <div
                  key={key}
                  className={`rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 relative border ${isPopular
                      ? 'bg-gradient-to-b from-purple-950/40 via-zinc-900 to-[#14141b] border-purple-500/50 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/40'
                      : isCurrent
                        ? 'bg-zinc-900/90 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : isFree
                          ? 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'
                    }`}
                >
                  {/* Top Badges */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold tracking-wider uppercase text-zinc-400">
                      {plan.displayName}
                    </span>
                    {plan.badge && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                        {plan.badge}
                      </span>
                    )}
                    {isFree && !plan.badge && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Cortesía
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        {lang === 'es' ? '✓ Activo' : '✓ Current'}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">${plan.priceUsd}</span>
                      <span className="text-xs text-zinc-400 font-medium">{isFree ? 'USD' : 'USD / mes'}</span>
                    </div>
                    <div className="mt-2 text-[11px] bg-black/40 border border-zinc-800 rounded-lg p-2 text-zinc-300 space-y-1">
                      <div className={`flex justify-between font-semibold ${isFree ? 'text-amber-400/90' : 'text-emerald-400'}`}>
                        <span>🧠 AutoProd Brain™:</span>
                        <span>{isFree ? '1 crédito / acción' : '100% GRATIS'}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-purple-300">
                        <span>⚙️ Motor Local (GPU/PC):</span>
                        <span>⚡ Desbloqueado</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>🪙 Bolsa de Tokens:</span>
                        <span className="text-white font-bold">{credits.toLocaleString()} pts {isFree ? '(Prueba)' : `(~$${netTokens} USD)`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature List */}
                  <div className="space-y-2 mb-5 text-xs text-zinc-300 flex-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Incluye:</p>
                    {plan.features.map((feat, i) => {
                      const isExcluded = feat.startsWith('❌');
                      const isHighlight = feat.startsWith('⚡');
                      const cleanFeat = isExcluded ? feat.replace(/^❌\s*/, '') : isHighlight ? feat.replace(/^⚡\s*/, '') : feat;
                      return (
                        <div key={i} className="flex items-start gap-1.5">
                          {isExcluded ? (
                            <span className="text-red-400/80 text-xs mt-0.5 shrink-0 font-bold">✗</span>
                          ) : isHighlight ? (
                            <span className="text-amber-400 text-xs mt-0.5 shrink-0 font-bold">⚡</span>
                          ) : (
                            <span className="text-purple-400 text-xs mt-0.5 shrink-0">✓</span>
                          )}
                          <span className={`leading-snug text-[11px] sm:text-xs ${isExcluded
                              ? 'text-zinc-500 line-through'
                              : isHighlight
                                ? 'text-zinc-100 font-semibold'
                                : 'text-zinc-300'
                            }`}>
                            {cleanFeat}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                    {isFree ? (
                      <div className="space-y-1">
                        <div className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${isCurrent
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800'
                          }`}>
                          <span>{isCurrent ? '✓' : '•'}</span>
                          <span>{isCurrent ? (lang === 'es' ? 'Tu Plan Actual' : 'Your Current Plan') : (lang === 'es' ? 'Nivel Básico Gratuito' : 'Free Basic Tier')}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 text-center">
                          {isCurrent ? (lang === 'es' ? 'Sube a Starter o Pro para desbloquear el Motor Local' : 'Upgrade to Starter or Pro to unlock Local Motor') : ''}
                        </p>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCheckout(key as 'STARTER' | 'PRO' | 'ENTERPRISE')}
                          disabled={isLoadingCheckout || isCurrent}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${isCurrent
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : isPopular
                                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white shadow-purple-600/30'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            }`}
                        >
                          <span>💳</span>
                          <span>
                            {isCurrent
                              ? (lang === 'es' ? 'Plan Actual' : 'Current Plan')
                              : (lang === 'es' ? `Suscribirme a ${plan.name}` : `Subscribe to ${plan.name}`)}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedPlan(key as 'STARTER' | 'PRO' | 'ENTERPRISE');
                            setShowNequiModal(true);
                          }}
                          className="w-full py-1.5 px-2.5 rounded-xl font-semibold text-[11px] bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>⚡</span>
                          <span>{lang === 'es' ? 'Pagar con Nequi' : 'Pay with Nequi'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Economics & Motor Local Note */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-400 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-200 font-bold">
                <span>💡</span>
                <span>Economía de Tokens, AutoProd Brain™ y Motor Local</span>
              </div>
              <span className="text-[10px] text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                Arquitectura Híbrida Web + Local
              </span>
            </div>
            <p className="leading-relaxed text-[11px]">
              <strong className="text-white">⚙️ Motor Local (Beneficio exclusivo a partir de Starter $70):</strong> Te permite instalar el helper local de Python en tu PC, aprovechando tu tarjeta gráfica (GPU/CPU) para procesar subtítulos Whisper ilimitados y renderizar video a costo $0 de servidor. En la prueba gratuita, el motor local no está disponible para descarga.
            </p>
            <p className="leading-relaxed text-[11px]">
              <strong className="text-white">🧠 AutoProd Brain™ (Cerebro Autónomo 24/7):</strong> En todos los planes de pago, las llamadas a gpt-4o-mini para orquestar canales y redactar guiones son 100% gratuitas e ilimitadas. Tu bolsa mensual (1,800, 2,700 o 4,500 créditos) queda reservada íntegramente para procesos de alta demanda (modelos pesados, imágenes y renders cloud).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#0f0f13] flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>🔒 Pagos 100% seguros con cifrado TLS vía Lemon Squeezy o verificación Nequi.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors font-medium cursor-pointer"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </div>

      {/* Sub-modal: Nequi / Transferencia Manual */}
      {showNequiModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-60 p-4">
          <div className="bg-[#141419] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setShowNequiModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
                ⚡
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'es' ? 'Pago por Nequi / Bancolombia' : 'Manual Nequi Transfer'}
                </h3>
                <p className="text-xs text-zinc-400">Activación inmediata por el equipo de AutoProd</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <span className="text-zinc-400">Plan seleccionado:</span>
                <span className="text-white font-bold">{PLANS_CONFIG[selectedPlan].displayName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <span className="text-zinc-400">Total a pagar:</span>
                <span className="text-emerald-400 font-extrabold text-sm">
                  ${PLANS_CONFIG[selectedPlan].priceUsd} USD <span className="text-[10px] text-zinc-500">(o equivalente en COP a TRM del día)</span>
                </span>
              </div>
              <div>
                <p className="text-zinc-400 mb-1 font-semibold">Datos para la transferencia:</p>
                <div className="bg-black/60 rounded-lg p-2.5 font-mono text-[11px] text-zinc-300 space-y-1 select-all border border-zinc-800">
                  <p>📱 <strong>Nequi / Daviplata:</strong> 300 123 4567</p>
                  <p>🏦 <strong>Bancolombia Ahorros:</strong> 123-456789-01</p>
                  <p>👤 <strong>Titular:</strong> AutoProd Media SAS</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Una vez enviado el comprobante a nuestro canal oficial de soporte con tu correo ({userEmail || 'tu email'}), el administrador activará tu suscripción y se acreditarán automáticamente tus tokens en tu Wallet.
              </p>

              <a
                href={getWhatsAppMessage(selectedPlan)}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <span>💬</span>
                <span>{lang === 'es' ? 'Enviar Comprobante por WhatsApp' : 'Send Receipt via WhatsApp'}</span>
              </a>

              <button
                onClick={() => setShowNequiModal(false)}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-medium transition-colors cursor-pointer"
              >
                {lang === 'es' ? 'Volver a los planes' : 'Back to plans'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
