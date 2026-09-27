import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../../profile/data/repositories/user_repository.dart';

class PaymentScreen extends ConsumerWidget {
  const PaymentScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Paiements & virements')),
      body: userAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
        data: (user) {
          final hasStripeAccount = user?.stripeAccountId != null &&
              user!.stripeAccountId!.isNotEmpty;

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // ── Moyen de paiement ─────────────────────────────────────
              Text(
                'Moyen de paiement',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              _InfoCard(
                icon: Icons.credit_card_rounded,
                title: 'Carte bancaire',
                subtitle: user?.stripeCustomerId != null
                    ? 'Carte enregistrée via Stripe'
                    : 'Aucune carte enregistrée',
                action: 'Gérer',
                onTap: () {
                  // TODO: open Stripe payment sheet
                },
              ).animate().fadeIn(duration: 300.ms),

              const SizedBox(height: 24),

              // ── Compte chauffeur ──────────────────────────────────────
              Text(
                'Compte chauffeur',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              if (hasStripeAccount) ...[
                _InfoCard(
                  icon: Icons.account_balance_rounded,
                  title: 'Compte Stripe Connect',
                  subtitle: 'Vos gains sont versés sur votre compte bancaire.',
                  action: 'Voir',
                  onTap: () {
                    // TODO: open Stripe dashboard link
                  },
                ),
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: VoyajColors.primary.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color: VoyajColors.primary.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Devenez chauffeur Voyaj',
                        style: theme.textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: VoyajColors.primary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Configurez votre compte Stripe Connect pour recevoir vos gains directement sur votre compte bancaire.',
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () {
                          // TODO: start Stripe Connect onboarding
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: VoyajColors.primary,
                        ),
                        child: const Text('Configurer le compte'),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // ── Historique des transactions ───────────────────────────
              Text(
                'Transactions récentes',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'Aucune transaction récente',
                  style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String action;
  final VoidCallback onTap;

  const _InfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.action,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: VoyajColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: VoyajColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                Text(subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
          TextButton(onPressed: onTap, child: Text(action)),
        ],
      ),
    );
  }
}
