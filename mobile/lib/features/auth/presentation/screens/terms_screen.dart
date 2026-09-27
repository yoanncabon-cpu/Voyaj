import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/constants/app_constants.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Conditions d\'utilisation')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Conditions générales d\'utilisation',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Dernière mise à jour : septembre 2026',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    '''Voyaj est une plateforme de mise en relation entre passagers et conducteurs partageant un trajet. Elle n'est pas un service de transport professionnel.

En utilisant Voyaj, vous acceptez :

• De respecter la réglementation française en vigueur concernant le covoiturage (article L3132-1 du Code des transports).

• Que les sommes échangées correspondent uniquement au partage des frais réels du trajet (carburant + usure).

• De fournir des informations exactes sur votre identité et votre véhicule.

• De traiter les autres utilisateurs avec respect.

• Que Voyaj n'est pas responsable des incidents survenus pendant les trajets.

Politique de confidentialité

Vos données personnelles (nom, téléphone, position GPS, pièce d'identité) sont traitées conformément au RGPD. Elles ne sont jamais vendues à des tiers.

Vous disposez d'un droit d'accès, de rectification et de suppression de vos données via les paramètres de l'application.

[Document complet disponible sur voyajapp.com/legal]''',
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton(
                  onPressed: () => context.go(AppConstants.routeDriverHome),
                  child: const Text('J\'accepte et je continue'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => context.go(AppConstants.routeAuthChoice),
                  child: const Text('Refuser'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
