import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../shared/constants/app_constants.dart';

class SafeReturnScreen extends StatefulWidget {
  const SafeReturnScreen({super.key});

  @override
  State<SafeReturnScreen> createState() => _SafeReturnScreenState();
}

class _SafeReturnScreenState extends State<SafeReturnScreen> {
  bool _loading = false;
  String? _trackingUrl;
  bool _active = false;

  Future<void> _start() async {
    setState(() => _loading = true);
    try {
      final result = await FirebaseFunctions.instanceFor(
              region: AppConstants.firebaseRegion)
          .httpsCallable('startSafeReturn')
          .call({
        'uid': FirebaseAuth.instance.currentUser!.uid,
      });
      final url = result.data['publicUrl'] as String?;
      setState(() {
        _trackingUrl = url;
        _active = true;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  void _copyUrl() {
    if (_trackingUrl == null) return;
    Clipboard.setData(ClipboardData(text: _trackingUrl!));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Lien copié !')),
    );
  }

  Future<void> _shareUrl() async {
    if (_trackingUrl == null) return;
    // TODO: use share_plus when available
    _copyUrl();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Je suis bien rentré(e)')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Explication
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.orange.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.security_rounded,
                          color: Colors.orange),
                      const SizedBox(width: 8),
                      Text(
                        'Comment ça marche ?',
                        style: theme.textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.orange),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '1. Activez le suivi et partagez le lien à un proche\n'
                    '2. Votre position est mise à jour automatiquement\n'
                    '3. Le suivi expire après 6h ou quand vous désactivez',
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

            const SizedBox(height: 32),

            if (!_active) ...[
              // ── Pas encore activé ─────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: colorScheme.surfaceContainerHighest,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.location_on_outlined,
                        size: 48,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Suivi de trajet inactif',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Activez le suivi pour partager votre position en temps réel.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 100.ms, duration: 300.ms),

              const Spacer(),

              FilledButton.icon(
                onPressed: _loading ? null : _start,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.play_arrow_rounded),
                label: const Text('Activer le suivi'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  backgroundColor: Colors.orange,
                ),
              ),
            ] else ...[
              // ── Suivi actif ──────────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        size: 48,
                        color: Colors.white,
                      ),
                    )
                        .animate(onPlay: (c) => c.repeat())
                        .scale(
                            begin: const Offset(1, 1),
                            end: const Offset(1.1, 1.1),
                            duration: 1000.ms)
                        .then()
                        .scale(
                            begin: const Offset(1.1, 1.1),
                            end: const Offset(1, 1),
                            duration: 1000.ms),
                    const SizedBox(height: 16),
                    Text(
                      'Suivi actif',
                      style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: Colors.green),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // URL de partage
              if (_trackingUrl != null) ...[
                Text(
                  'Partagez ce lien à un proche :',
                  style: theme.textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _trackingUrl!,
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        onPressed: _copyUrl,
                      ),
                    ],
                  ),
                ),
              ],

              const Spacer(),

              OutlinedButton.icon(
                onPressed: () {
                  setState(() {
                    _active = false;
                    _trackingUrl = null;
                  });
                },
                icon: const Icon(Icons.stop_rounded),
                label: const Text('Désactiver le suivi'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  foregroundColor: colorScheme.error,
                  side: BorderSide(color: colorScheme.error),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
