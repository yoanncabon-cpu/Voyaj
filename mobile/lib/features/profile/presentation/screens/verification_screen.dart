import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:io';

import '../../data/repositories/user_repository.dart';

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});

  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  File? _idDoc;
  bool _uploading = false;
  bool _uploaded = false;

  Future<void> _pickDoc() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() => _idDoc = File(picked.path));
    }
  }

  Future<void> _submit() async {
    if (_idDoc == null) return;
    setState(() => _uploading = true);

    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;
      final ref =
          FirebaseStorage.instance.ref('identity/$uid/id_document.jpg');
      await ref.putFile(_idDoc!);
      // Marquer la vérification comme en attente
      final fn = FirebaseFunctions.instanceFor(region: 'europe-west1')
          .httpsCallable('setVerificationPending');
      await fn.call({});
      setState(() {
        _uploading = false;
        _uploaded = true;
      });
    } catch (e) {
      setState(() => _uploading = false);
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
    final userAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Vérification d\'identité')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: userAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Erreur : $e')),
          data: (user) {
            if (user?.isVerified == true) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.verified_rounded,
                        size: 72, color: Colors.green),
                    const SizedBox(height: 16),
                    Text(
                      'Identité vérifiée',
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ).animate().scale(duration: 400.ms),
              );
            }

            if (_uploaded || user?.verificationStatus.name == 'pending') {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.hourglass_empty_rounded,
                        size: 72, color: Colors.orange),
                    const SizedBox(height: 16),
                    Text(
                      'En cours de vérification',
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Notre équipe vérifie votre identité. Vous serez notifié sous 24–48h.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ).animate().fadeIn(duration: 400.ms),
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Vérifiez votre identité',
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Envoyez une photo de votre pièce d\'identité (CNI ou passeport) pour conduire sur Voyaj.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 32),

                // Zone de drop
                GestureDetector(
                  onTap: _pickDoc,
                  child: Container(
                    height: 180,
                    decoration: BoxDecoration(
                      color: colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: _idDoc != null
                            ? Colors.green
                            : colorScheme.outlineVariant,
                        width: 2,
                      ),
                    ),
                    child: _idDoc != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Image.file(_idDoc!, fit: BoxFit.cover),
                          )
                        : Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add_photo_alternate_outlined,
                                    size: 48,
                                    color: colorScheme.onSurfaceVariant),
                                const SizedBox(height: 8),
                                Text('Sélectionner un document',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                        color: colorScheme.onSurfaceVariant)),
                              ],
                            ),
                          ),
                  ),
                ),

                const SizedBox(height: 16),
                Text(
                  '• Format : photo ou scan, JPG / PNG\n'
                  '• Taille maximale : 20 Mo\n'
                  '• Document valide, non expiré, lisible',
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant),
                ),

                const Spacer(),

                FilledButton(
                  onPressed: (_idDoc == null || _uploading) ? null : _submit,
                  style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52)),
                  child: _uploading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Envoyer pour vérification'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
