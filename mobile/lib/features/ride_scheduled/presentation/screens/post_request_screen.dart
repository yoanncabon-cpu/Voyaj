import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';

/// Publier une demande de trajet (passager cherche un conducteur).
class PostRequestScreen extends StatefulWidget {
  const PostRequestScreen({super.key});

  @override
  State<PostRequestScreen> createState() => _PostRequestScreenState();
}

class _PostRequestScreenState extends State<PostRequestScreen> {
  final _originCtrl = TextEditingController();
  final _destinationCtrl = TextEditingController();
  DateTime? _date;
  bool _submitting = false;

  @override
  void dispose() {
    _originCtrl.dispose();
    _destinationCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_originCtrl.text.trim().isEmpty || _destinationCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Remplissez le départ et l\'arrivée')),
      );
      return;
    }
    if (_date == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Choisissez une date')));
      return;
    }

    setState(() => _submitting = true);
    try {
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid == null) throw Exception('Non connecté');

      await FirebaseFirestore.instance.collection('ride_requests').add({
        'passengerId': uid,
        'originAddress': _originCtrl.text.trim(),
        'destinationAddress': _destinationCtrl.text.trim(),
        'requestedDate': Timestamp.fromDate(_date!),
        'status': 'open',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demande publiée !')),
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

    return Scaffold(
      appBar: AppBar(title: const Text('Poster une demande')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Vous ne trouvez pas de trajet ? Postez une demande.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),

            TextField(
              controller: _originCtrl,
              decoration: const InputDecoration(labelText: 'Ville de départ'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _destinationCtrl,
              decoration: const InputDecoration(labelText: 'Ville d\'arrivée'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now(),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 14)),
                );
                if (d != null) setState(() => _date = d);
              },
              icon: const Icon(Icons.calendar_today_rounded),
              label: Text(_date == null
                  ? 'Choisir une date'
                  : '${_date!.day}/${_date!.month}/${_date!.year}'),
            ),

            const Spacer(),

            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: VoyajColors.secondary,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Publier ma demande'),
            ),
          ],
        ),
      ),
    );
  }
}
