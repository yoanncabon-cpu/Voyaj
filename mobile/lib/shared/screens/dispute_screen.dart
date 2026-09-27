import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../constants/app_constants.dart';

class DisputeScreen extends StatefulWidget {
  final String rideId;
  const DisputeScreen({super.key, required this.rideId});

  @override
  State<DisputeScreen> createState() => _DisputeScreenState();
}

class _DisputeScreenState extends State<DisputeScreen> {
  final _descCtrl = TextEditingController();
  String _reason = 'wrong_price';
  bool _submitting = false;

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_descCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez décrire le problème')),
      );
      return;
    }
    setState(() => _submitting = true);

    try {
      await FirebaseFunctions.instanceFor(
              region: AppConstants.firebaseRegion)
          .httpsCallable('createDispute')
          .call({
        'rideId': widget.rideId,
        'reason': _reason,
        'description': _descCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Litige soumis. Notre équipe vous contactera.')),
        );
        context.pop();
      }
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Signaler un problème')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Quel est le problème ?',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            // Motif
            ...[
              ('wrong_price', 'Montant incorrect'),
              ('no_show_driver', 'Chauffeur absent'),
              ('safety', 'Problème de sécurité'),
              ('vehicle', 'Véhicule différent'),
              ('other', 'Autre problème'),
            ].map((e) => RadioListTile<String>(
                  title: Text(e.$2),
                  value: e.$1,
                  groupValue: _reason,
                  onChanged: (v) => setState(() => _reason = v!),
                  contentPadding: EdgeInsets.zero,
                )),

            const SizedBox(height: 16),

            // Description
            TextField(
              controller: _descCtrl,
              minLines: 3,
              maxLines: 6,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: 'Description',
                hintText: 'Décrivez le problème en détail…',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),

            const Spacer(),

            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: colorScheme.error,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Envoyer le signalement'),
            ),
          ],
        ),
      ),
    );
  }
}
