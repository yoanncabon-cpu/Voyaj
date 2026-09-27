import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';

/// Écran de publication d'un trajet programmé.
class PublishRideScreen extends StatefulWidget {
  const PublishRideScreen({super.key});

  @override
  State<PublishRideScreen> createState() => _PublishRideScreenState();
}

class _PublishRideScreenState extends State<PublishRideScreen> {
  final _formKey = GlobalKey<FormState>();
  final _originCtrl = TextEditingController();
  final _destinationCtrl = TextEditingController();
  DateTime? _departureDate;
  TimeOfDay? _departureTime;
  int _seats = 3;
  bool _recurringDaily = false;
  bool _publishing = false;

  @override
  void dispose() {
    _originCtrl.dispose();
    _destinationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 14)),
    );
    if (d != null) setState(() => _departureDate = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 8, minute: 0),
    );
    if (t != null) setState(() => _departureTime = t);
  }

  Future<void> _publish() async {
    if (!_formKey.currentState!.validate()) return;
    if (_departureDate == null || _departureTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez choisir une date et heure')),
      );
      return;
    }
    setState(() => _publishing = true);

    try {
      final departure = DateTime(
        _departureDate!.year,
        _departureDate!.month,
        _departureDate!.day,
        _departureTime!.hour,
        _departureTime!.minute,
      );
      final fn = FirebaseFunctions.instanceFor(region: 'europe-west1')
          .httpsCallable('publishScheduledRide');
      await fn.call({
        'originAddress': _originCtrl.text.trim(),
        'destinationAddress': _destinationCtrl.text.trim(),
        'departureAt': departure.toIso8601String(),
        'seats': _seats,
        'recurringDaily': _recurringDaily,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Trajet publié !')),
        );
        context.pop();
      }
    } catch (e) {
      setState(() => _publishing = false);
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
      appBar: AppBar(title: const Text('Publier un trajet')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Votre trajet',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),

            // Départ
            TextFormField(
              controller: _originCtrl,
              decoration: const InputDecoration(
                labelText: 'Ville de départ',
                prefixIcon: Icon(Icons.circle_rounded, color: Colors.green, size: 14),
              ),
              validator: (v) =>
                  v != null && v.trim().isNotEmpty ? null : 'Départ requis',
            ),
            const SizedBox(height: 16),

            // Arrivée
            TextFormField(
              controller: _destinationCtrl,
              decoration: const InputDecoration(
                labelText: 'Ville d\'arrivée',
                prefixIcon: Icon(Icons.location_on_rounded,
                    color: VoyajColors.primary, size: 14),
              ),
              validator: (v) =>
                  v != null && v.trim().isNotEmpty ? null : 'Destination requise',
            ),
            const SizedBox(height: 24),

            // Date
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.calendar_today_rounded),
                    label: Text(_departureDate == null
                        ? 'Date'
                        : '${_departureDate!.day}/${_departureDate!.month}/${_departureDate!.year}'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickTime,
                    icon: const Icon(Icons.access_time_rounded),
                    label: Text(_departureTime == null
                        ? 'Heure'
                        : _departureTime!.format(context)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Nombre de places
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Places disponibles',
                    style: theme.textTheme.labelLarge),
                Row(
                  children: [
                    IconButton(
                      onPressed: _seats > 1
                          ? () => setState(() => _seats--)
                          : null,
                      icon: const Icon(Icons.remove_circle_outline_rounded),
                    ),
                    Text('$_seats',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    IconButton(
                      onPressed: _seats < 7
                          ? () => setState(() => _seats++)
                          : null,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Trajet régulier
            SwitchListTile(
              title: const Text('Trajet régulier (quotidien)'),
              subtitle: const Text('Publié automatiquement sur 14 jours'),
              value: _recurringDaily,
              onChanged: (v) => setState(() => _recurringDaily = v),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 32),

            FilledButton(
              onPressed: _publishing ? null : _publish,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: VoyajColors.primary,
              ),
              child: _publishing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Publier le trajet',
                      style: TextStyle(fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
