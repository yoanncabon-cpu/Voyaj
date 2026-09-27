import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';

class AuthChoiceScreen extends StatelessWidget {
  const AuthChoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const Spacer(),

              // Logo
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: VoyajColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  Icons.directions_car_rounded,
                  size: 48,
                  color: VoyajColors.primary,
                ),
              )
                  .animate()
                  .fadeIn(duration: 600.ms)
                  .scale(begin: const Offset(0.8, 0.8)),

              const SizedBox(height: 20),

              Text(
                'Bienvenue sur Voyaj',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2),

              const SizedBox(height: 8),

              Text(
                'Connectez-vous ou créez un compte pour commencer',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ).animate(delay: 300.ms).fadeIn(),

              const Spacer(),

              // Boutons
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FilledButton.icon(
                    onPressed: () => context.push(AppConstants.routeAuthPhone),
                    icon: const Icon(Icons.phone_rounded),
                    label: const Text('Continuer avec le téléphone'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => context.push(AppConstants.routeAuthEmail),
                    icon: const Icon(Icons.email_outlined),
                    label: const Text('Continuer avec l\'e-mail'),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'En continuant, vous acceptez nos ',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                  GestureDetector(
                    onTap: () => context.push(AppConstants.routeTerms),
                    child: Text(
                      'Conditions d\'utilisation et Politique de confidentialité',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: VoyajColors.primary,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ).animate(delay: 400.ms).fadeIn().slideY(begin: 0.2),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
